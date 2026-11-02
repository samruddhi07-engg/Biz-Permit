const { query, getConnection } = require('../config/mysql');

class IssuedLicenseRepository {
  async findById(id) {
    const rows = await query(
      `SELECT il.*, 
              b.business_name, b.registration_number AS business_reg, b.address_line1, b.address_line2, b.city, b.state, b.postal_code,
              lt.name AS license_name, lt.code AS license_code, lt.fee,
              d.name AS department_name, d.code AS department_code,
              u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
       FROM issued_licenses il
       JOIN businesses b ON il.business_id = b.id
       JOIN license_types lt ON il.license_type_id = lt.id
       JOIN departments d ON lt.department_id = d.id
       JOIN users u ON il.owner_id = u.id
       WHERE il.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findByLicenseNumber(licenseNumber) {
    const rows = await query('SELECT id FROM issued_licenses WHERE license_number = ?', [licenseNumber]);
    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  async findByQrCode(qrCode) {
    const rows = await query('SELECT id FROM issued_licenses WHERE qr_verification_code = ?', [qrCode]);
    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  async getAll(filters = {}) {
    let sql = `
      SELECT il.*, 
             b.business_name, b.city,
             lt.name AS license_name, lt.code AS license_code,
             d.name AS department_name,
             u.full_name AS owner_name
      FROM issued_licenses il
      JOIN businesses b ON il.business_id = b.id
      JOIN license_types lt ON il.license_type_id = lt.id
      JOIN departments d ON lt.department_id = d.id
      JOIN users u ON il.owner_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.ownerId) {
      conditions.push('il.owner_id = ?');
      params.push(filters.ownerId);
    }

    if (filters.status) {
      conditions.push('il.status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push('(il.license_number LIKE ? OR b.business_name LIKE ? OR lt.name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY il.issue_date DESC';
    return await query(sql, params);
  }

  /**
   * Transactional Approval and License Issuance
   */
  async approveAndIssue(applicationId, officerId, remarks = 'Approved by licensing officer') {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Check if application exists and is not already issued
      const [appRows] = await conn.execute(
        `SELECT a.id, a.business_id, a.license_type_id, a.owner_id, a.status, 
                lt.validity_months, lt.name AS license_name, u.email AS owner_email
         FROM applications a
         JOIN license_types lt ON a.license_type_id = lt.id
         JOIN users u ON a.owner_id = u.id
         WHERE a.id = ? FOR UPDATE`,
        [applicationId]
      );

      if (appRows.length === 0) {
        throw new Error('Application not found');
      }

      const app = appRows[0];
      if (app.status === 'APPROVED') {
        throw new Error('Application is already approved and issued.');
      }

      // 1. Update application status
      await conn.execute(
        `UPDATE applications SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), decision_remarks = ?, updated_at = NOW() WHERE id = ?`,
        [officerId, remarks, applicationId]
      );

      // 2. Status History
      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, ?, 'APPROVED', ?, ?)`,
        [applicationId, app.status, officerId, remarks]
      );

      // 3. Generate License Number & QR Code
      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const licenseNumber = `LIC-${year}-${randNum}`;
      const qrCode = `QR-VERIFY-${randNum}-${year}-MUNI`;

      const validityMonths = app.validity_months || 12;

      // 4. Insert into issued_licenses
      const [licRes] = await conn.execute(
        `INSERT INTO issued_licenses 
          (license_number, application_id, business_id, license_type_id, owner_id, issue_date, expiry_date, status, qr_verification_code)
         VALUES (?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? MONTH), 'ACTIVE', ?)`,
        [
          licenseNumber,
          applicationId,
          app.business_id,
          app.license_type_id,
          app.owner_id,
          validityMonths,
          qrCode
        ]
      );

      // 5. Notify Owner
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, notification_type, link_url)
         VALUES (?, ?, ?, 'SUCCESS', ?)`,
        [
          app.owner_id,
          `License Issued: ${licenseNumber}`,
          `Your application for ${app.license_name} has been approved. Your license ${licenseNumber} is now active.`,
          `/owner/license-certificate.html?id=${licRes.insertId}`
        ]
      );

      await conn.commit();
      return this.findById(licRes.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Create Renewal Application linked to parent issued license
   */
  async createRenewal(licenseId, ownerId) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const [licRows] = await conn.execute(
        'SELECT * FROM issued_licenses WHERE id = ? AND owner_id = ? FOR UPDATE',
        [licenseId, ownerId]
      );

      if (licRows.length === 0) {
        throw new Error('Authorized active license not found.');
      }

      const lic = licRows[0];

      // Check if there is already an active pending application for this renewal
      const [existingApps] = await conn.execute(
        `SELECT id FROM applications 
         WHERE parent_license_id = ? AND status NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')`,
        [licenseId]
      );

      if (existingApps.length > 0) {
        throw new Error('A renewal application is already in progress for this license.');
      }

      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const appNumber = `APP-REN-${year}-${randNum}`;

      const [appRes] = await conn.execute(
        `INSERT INTO applications 
          (application_number, business_id, license_type_id, owner_id, application_type, parent_license_id, status)
         VALUES (?, ?, ?, ?, 'RENEWAL', ?, 'DRAFT')`,
        [appNumber, lic.business_id, lic.license_type_id, ownerId, licenseId]
      );

      const newAppId = appRes.insertId;

      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, NULL, 'DRAFT', ?, ?)`,
        [newAppId, ownerId, `Renewal draft initiated for active permit ${lic.license_number}`]
      );

      await conn.commit();
      return newAppId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new IssuedLicenseRepository();
