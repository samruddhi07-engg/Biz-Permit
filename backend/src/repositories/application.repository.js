const { query, getConnection } = require('../config/mysql');

class ApplicationRepository {
  async findById(id) {
    const rows = await query(
      `SELECT a.*, 
              b.business_name, b.registration_number AS business_reg, b.address_line1, b.city, b.state, b.postal_code,
              bc.name AS category_name, bc.code AS category_code,
              lt.name AS license_name, lt.code AS license_code, lt.fee, lt.validity_months, lt.requires_inspection,
              d.name AS department_name, d.code AS department_code,
              u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
              rev.full_name AS reviewer_name
       FROM applications a
       JOIN businesses b ON a.business_id = b.id
       JOIN business_categories bc ON b.category_id = bc.id
       JOIN license_types lt ON a.license_type_id = lt.id
       JOIN departments d ON lt.department_id = d.id
       JOIN users u ON a.owner_id = u.id
       LEFT JOIN users rev ON a.reviewed_by = rev.id
       WHERE a.id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    const app = rows[0];
    app.fee = parseFloat(app.fee);

    // Status History
    app.statusHistory = await query(
      `SELECT ash.*, u.full_name AS changed_by_name
       FROM application_status_history ash
       JOIN users u ON ash.changed_by = u.id
       WHERE ash.application_id = ?
       ORDER BY ash.created_at ASC`,
      [id]
    );

    // Assignments
    app.assignments = await query(
      `SELECT aa.*, u.full_name AS assigned_to_name, ab.full_name AS assigned_by_name
       FROM application_assignments aa
       JOIN users u ON aa.assigned_to = u.id
       JOIN users ab ON aa.assigned_by = ab.id
       WHERE aa.application_id = ?
       ORDER BY aa.assigned_at DESC`,
      [id]
    );

    // Payments
    app.payments = await query(
      `SELECT * FROM application_payments WHERE application_id = ? ORDER BY paid_at DESC`,
      [id]
    );

    // Inspections
    app.inspections = await query(
      `SELECT i.*, u.full_name AS inspector_name
       FROM inspections i
       JOIN users u ON i.inspector_id = u.id
       WHERE i.application_id = ?
       ORDER BY i.created_at DESC`,
      [id]
    );

    return app;
  }

  async findByApplicationNumber(appNumber) {
    const rows = await query('SELECT id FROM applications WHERE application_number = ?', [appNumber]);
    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  async getAll(filters = {}) {
    let sql = `
      SELECT a.id, a.application_number, a.status, a.application_type, a.submission_date, a.created_at, a.updated_at,
             b.business_name, b.id AS business_id,
             lt.name AS license_name, lt.code AS license_code, lt.fee,
             d.name AS department_name, d.id AS department_id,
             u.full_name AS owner_name, u.email AS owner_email, u.id AS owner_id,
             rev.full_name AS reviewer_name,
             MAX(ass.assigned_to) AS assigned_to,
             MAX(ass_u.full_name) AS assigned_to_name
      FROM applications a
      JOIN businesses b ON a.business_id = b.id
      JOIN license_types lt ON a.license_type_id = lt.id
      JOIN departments d ON lt.department_id = d.id
      JOIN users u ON a.owner_id = u.id
      LEFT JOIN users rev ON a.reviewed_by = rev.id
      LEFT JOIN application_assignments ass ON a.id = ass.application_id
      LEFT JOIN users ass_u ON ass.assigned_to = ass_u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.ownerId) {
      conditions.push('a.owner_id = ?');
      params.push(filters.ownerId);
    }

    if (filters.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    if (filters.assignedTo) {
      conditions.push('ass.assigned_to = ?');
      params.push(filters.assignedTo);
    }

    if (filters.departmentId) {
      conditions.push('lt.department_id = ?');
      params.push(filters.departmentId);
    }

    if (filters.search) {
      conditions.push('(a.application_number LIKE ? OR b.business_name LIKE ? OR lt.name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY a.id, b.business_name, b.id, lt.name, lt.code, lt.fee, d.name, d.id, u.full_name, u.email, u.id, rev.full_name ORDER BY a.updated_at DESC';

    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      fee: parseFloat(r.fee)
    }));
  }

  async create(appData) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Generate application number: APP-YYYY-XXXX
      const year = new Date().getFullYear();
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const appNumber = `APP-${year}-${randSuffix}`;

      const [res] = await conn.execute(
        `INSERT INTO applications 
          (application_number, business_id, license_type_id, owner_id, application_type, parent_license_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
        [
          appNumber,
          appData.businessId,
          appData.licenseTypeId,
          appData.ownerId,
          appData.applicationType || 'NEW',
          appData.parentLicenseId || null
        ]
      );
      const appId = res.insertId;

      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, NULL, 'DRAFT', ?, 'Draft application created.')`,
        [appId, appData.ownerId]
      );

      await conn.commit();
      return this.findById(appId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async submit(id, userId, paymentRef = null) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        'SELECT a.id, a.status, lt.fee FROM applications a JOIN license_types lt ON a.license_type_id = lt.id WHERE a.id = ?',
        [id]
      );
      if (rows.length === 0) throw new Error('Application not found');
      const app = rows[0];

      // Update status to SUBMITTED
      await conn.execute(
        `UPDATE applications SET status = 'SUBMITTED', submission_date = NOW(), updated_at = NOW() WHERE id = ?`,
        [id]
      );

      // Record status history
      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, ?, 'SUBMITTED', ?, 'Application officially submitted with verified prerequisites.')`,
        [id, app.status, userId]
      );

      // Record simulated payment
      const txnRef = paymentRef || `TXN-MUNI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await conn.execute(
        `INSERT INTO application_payments (application_id, amount, transaction_reference, payment_method, payment_status)
         VALUES (?, ?, ?, 'SIMULATED_TREASURY_TRANSFER', 'SUCCESSFUL')`,
        [id, app.fee, txnRef]
      );

      // Auto-assign to available licensing officer
      const [officers] = await conn.execute(
        `SELECT u.id FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role = 'OFFICER' AND u.is_active = TRUE LIMIT 1`
      );
      if (officers.length > 0) {
        await conn.execute(
          `INSERT INTO application_assignments (application_id, assigned_to, assigned_by, role_type, notes)
           VALUES (?, ?, ?, 'OFFICER', 'Automated intake departmental assignment.')`,
          [id, officers[0].id, userId]
        );
      }

      await conn.commit();
      return this.findById(id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateStatus(id, newStatus, changedBy, remarks = null) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute('SELECT status FROM applications WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('Application not found');
      const oldStatus = rows[0].status;

      await conn.execute(
        `UPDATE applications SET status = ?, decision_remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [newStatus, remarks, changedBy, id]
      );

      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [id, oldStatus, newStatus, changedBy, remarks || `Status transitioned to ${newStatus}`]
      );

      await conn.commit();
      return this.findById(id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async assignOfficer(id, assignedTo, assignedBy, notes = null, roleType = 'OFFICER') {
    await query(
      `INSERT INTO application_assignments (application_id, assigned_to, assigned_by, role_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, assignedTo, assignedBy, roleType, notes]
    );
    return true;
  }

  async getMetrics() {
    const counts = await query(`
      SELECT 
        COUNT(*) AS total_applications,
        SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) AS under_review_count,
        SUM(CASE WHEN status = 'INSPECTION_REQUIRED' THEN 1 ELSE 0 END) AS inspection_count,
        SUM(CASE WHEN status = 'CORRECTION_REQUIRED' THEN 1 ELSE 0 END) AS correction_count,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count
      FROM applications
    `);

    const usersCount = await query('SELECT COUNT(*) AS total_users FROM users WHERE is_active = TRUE');
    const bizCount = await query('SELECT COUNT(*) AS total_businesses FROM businesses');
    const licenseCount = await query(`
      SELECT 
        COUNT(*) AS total_issued,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_licenses,
        SUM(CASE WHEN expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS expiring_soon
      FROM issued_licenses
    `);

    const revenue = await query(`SELECT SUM(amount) AS total_revenue FROM application_payments WHERE payment_status = 'SUCCESSFUL'`);

    return {
      applications: counts[0],
      totalUsers: usersCount[0].total_users,
      totalBusinesses: bizCount[0].total_businesses,
      licenses: licenseCount[0],
      revenue: parseFloat(revenue[0].total_revenue || 0)
    };
  }

  async getOwnerDashboard(ownerId) {
    const counts = await query(
      `SELECT 
        COUNT(*) AS total_applications,
        SUM(CASE WHEN status IN ('SUBMITTED', 'UNDER_REVIEW', 'INSPECTION_REQUIRED') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN status = 'CORRECTION_REQUIRED' THEN 1 ELSE 0 END) AS action_required_count
       FROM applications 
       WHERE owner_id = ?`,
      [ownerId]
    );

    const bizCount = await query('SELECT COUNT(*) AS total_businesses FROM businesses WHERE owner_id = ?', [ownerId]);
    const licenses = await query(
      `SELECT 
        COUNT(*) AS total_licenses,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_licenses,
        SUM(CASE WHEN expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS expiring_soon
       FROM issued_licenses 
       WHERE owner_id = ?`,
      [ownerId]
    );

    const recentApps = await query(
      `SELECT a.id, a.application_number, a.status, a.updated_at, b.business_name, lt.name AS license_name
       FROM applications a
       JOIN businesses b ON a.business_id = b.id
       JOIN license_types lt ON a.license_type_id = lt.id
       WHERE a.owner_id = ?
       ORDER BY a.updated_at DESC
       LIMIT 5`,
      [ownerId]
    );

    return {
      totalBusinesses: bizCount[0].total_businesses,
      applications: counts[0],
      licenses: licenses[0],
      recentApplications: recentApps
    };
  }
}

module.exports = new ApplicationRepository();
