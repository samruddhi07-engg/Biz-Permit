const { query, getConnection } = require('../config/mysql');

class PaymentRepository {
  /**
   * Get all payments for a given owner or across system for staff/admin
   */
  async getAll(filters = {}, user) {
    let sql = `
      SELECT ap.id, ap.application_id, ap.amount, ap.transaction_reference,
             ap.payment_method, ap.payment_status, ap.paid_at, ap.created_at,
             a.application_number, a.status AS application_status, a.owner_id,
             b.business_name, b.id AS business_id,
             lt.name AS license_name, lt.code AS license_code, lt.fee AS statutory_fee,
             u.full_name AS payer_name, u.email AS payer_email
      FROM application_payments ap
      JOIN applications a ON ap.application_id = a.id
      JOIN businesses b ON a.business_id = b.id
      JOIN license_types lt ON a.license_type_id = lt.id
      JOIN users u ON a.owner_id = u.id
    `;
    const params = [];
    const conditions = [];

    const isStaffOrAdmin = user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    if (!isStaffOrAdmin) {
      conditions.push('a.owner_id = ?');
      params.push(user.id);
    } else if (filters.ownerId) {
      conditions.push('a.owner_id = ?');
      params.push(filters.ownerId);
    }

    if (filters.status) {
      conditions.push('ap.payment_status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push('(ap.transaction_reference LIKE ? OR a.application_number LIKE ? OR b.business_name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY ap.paid_at DESC';

    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      statutory_fee: parseFloat(r.statutory_fee)
    }));
  }

  /**
   * Summary metrics for financial dashboard
   */
  async getStats(user) {
    const isStaffOrAdmin = user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    let baseWhere = isStaffOrAdmin ? '' : 'WHERE a.owner_id = ?';
    let baseParams = isStaffOrAdmin ? [] : [user.id];

    const statsSql = `
      SELECT 
        COALESCE(SUM(CASE WHEN ap.payment_status = 'SUCCESSFUL' THEN ap.amount ELSE 0 END), 0) AS total_paid,
        COUNT(CASE WHEN ap.payment_status = 'SUCCESSFUL' THEN 1 END) AS successful_count,
        COUNT(CASE WHEN ap.payment_status = 'PENDING' THEN 1 END) AS pending_count,
        COUNT(ap.id) AS total_transactions
      FROM application_payments ap
      JOIN applications a ON ap.application_id = a.id
      ${baseWhere}
    `;

    const [stats] = await query(statsSql, baseParams);

    // Also get pending applications awaiting payment (status = 'DRAFT' or without payment)
    const pendingAppsSql = `
      SELECT COUNT(a.id) AS awaiting_payment_count
      FROM applications a
      LEFT JOIN application_payments ap ON a.id = ap.application_id AND ap.payment_status = 'SUCCESSFUL'
      WHERE ap.id IS NULL AND a.status IN ('DRAFT', 'SUBMITTED')
      ${isStaffOrAdmin ? '' : 'AND a.owner_id = ?'}
    `;
    const [pendingApps] = await query(pendingAppsSql, baseParams);

    return {
      totalPaid: parseFloat(stats.total_paid || 0),
      successfulCount: parseInt(stats.successful_count || 0, 10),
      pendingCount: parseInt(stats.pending_count || 0, 10),
      totalTransactions: parseInt(stats.total_transactions || 0, 10),
      awaitingPaymentCount: parseInt(pendingApps.awaiting_payment_count || 0, 10)
    };
  }

  /**
   * Find single payment and receipt details with strict authorization
   */
  async findById(paymentId, user) {
    const sql = `
      SELECT ap.*, 
             a.application_number, a.status AS application_status, a.owner_id, a.submission_date,
             b.business_name, b.registration_number, b.address_line1, b.city, b.state, b.postal_code,
             lt.name AS license_name, lt.code AS license_code, lt.fee AS statutory_fee,
             d.name AS department_name, d.code AS department_code,
             u.full_name AS payer_name, u.email AS payer_email, u.phone AS payer_phone
      FROM application_payments ap
      JOIN applications a ON ap.application_id = a.id
      JOIN businesses b ON a.business_id = b.id
      JOIN license_types lt ON a.license_type_id = lt.id
      JOIN departments d ON lt.department_id = d.id
      JOIN users u ON a.owner_id = u.id
      WHERE ap.id = ? OR ap.transaction_reference = ?
    `;

    const rows = await query(sql, [paymentId, paymentId]);
    if (rows.length === 0) return null;

    const payment = rows[0];
    const isOwner = payment.owner_id === user.id;
    const isStaffOrAdmin = user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));

    if (!isOwner && !isStaffOrAdmin) {
      const err = new Error('Unauthorized to view this payment receipt.');
      err.statusCode = 403;
      throw err;
    }

    return {
      ...payment,
      amount: parseFloat(payment.amount),
      statutory_fee: parseFloat(payment.statutory_fee)
    };
  }

  /**
   * Create simulated payment with server-calculated amount and idempotency
   */
  async createSimulatedPayment(applicationId, userId) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Check application & verify ownership
      const [apps] = await conn.execute(
        `SELECT a.id, a.owner_id, a.status, a.application_number, lt.fee, lt.name AS license_name
         FROM applications a
         JOIN license_types lt ON a.license_type_id = lt.id
         WHERE a.id = ?`,
        [applicationId]
      );

      if (apps.length === 0) {
        const err = new Error('Application not found.');
        err.statusCode = 404;
        throw err;
      }

      const app = apps[0];
      if (app.owner_id !== userId) {
        const err = new Error('Unauthorized. You do not own this application.');
        err.statusCode = 403;
        throw err;
      }

      // Idempotency: check if application already has a successful payment
      const [existingPayments] = await conn.execute(
        `SELECT id, transaction_reference, amount, paid_at FROM application_payments 
         WHERE application_id = ? AND payment_status = 'SUCCESSFUL'`,
        [applicationId]
      );

      if (existingPayments.length > 0) {
        await conn.rollback();
        return existingPayments[0];
      }

      const authoritativeAmount = parseFloat(app.fee);
      const year = new Date().getFullYear();
      const randRef = Math.floor(100000 + Math.random() * 900000);
      const transactionRef = `TXN-IN-${year}-${randRef}`;

      const [res] = await conn.execute(
        `INSERT INTO application_payments 
         (application_id, amount, transaction_reference, payment_method, payment_status, paid_at)
         VALUES (?, ?, ?, 'SIMULATED_TREASURY_TRANSFER', 'SUCCESSFUL', NOW())`,
        [applicationId, authoritativeAmount, transactionRef]
      );

      await conn.commit();

      return {
        id: res.insertId,
        applicationId,
        amount: authoritativeAmount,
        transactionReference: transactionRef,
        paymentStatus: 'SUCCESSFUL',
        paymentMethod: 'SIMULATED_TREASURY_TRANSFER'
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new PaymentRepository();

