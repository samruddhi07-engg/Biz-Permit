const { query, getConnection } = require('../config/mysql');

class InspectionRepository {
  async findById(id) {
    const rows = await query(
      `SELECT i.*, 
              a.application_number, a.status AS application_status,
              b.business_name, b.address_line1, b.city, b.state, b.postal_code,
              lt.name AS license_name,
              insp.full_name AS inspector_name, insp.email AS inspector_email
       FROM inspections i
       JOIN applications a ON i.application_id = a.id
       JOIN businesses b ON a.business_id = b.id
       JOIN license_types lt ON a.license_type_id = lt.id
       JOIN users insp ON i.inspector_id = insp.id
       WHERE i.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async getAll(filters = {}) {
    let sql = `
      SELECT i.*, 
             a.application_number,
             b.business_name, b.city,
             lt.name AS license_name,
             insp.full_name AS inspector_name
      FROM inspections i
      JOIN applications a ON i.application_id = a.id
      JOIN businesses b ON a.business_id = b.id
      JOIN license_types lt ON a.license_type_id = lt.id
      JOIN users insp ON i.inspector_id = insp.id
    `;
    const params = [];
    const conditions = [];

    if (filters.inspectorId) {
      conditions.push('i.inspector_id = ?');
      params.push(filters.inspectorId);
    }

    if (filters.outcome) {
      conditions.push('i.outcome = ?');
      params.push(filters.outcome);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY i.scheduled_date DESC';
    return await query(sql, params);
  }

  async schedule(appId, inspectorId, scheduledDate, notes = null) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const [res] = await conn.execute(
        `INSERT INTO inspections (application_id, inspector_id, scheduled_date, outcome, summary_notes)
         VALUES (?, ?, ?, 'PENDING', ?)`,
        [appId, inspectorId, scheduledDate, notes]
      );
      const inspectionId = res.insertId;

      // Update application status to INSPECTION_REQUIRED
      await conn.execute(
        `UPDATE applications SET status = 'INSPECTION_REQUIRED', updated_at = NOW() WHERE id = ?`,
        [appId]
      );

      await conn.execute(
        `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
         VALUES (?, 'UNDER_REVIEW', 'INSPECTION_REQUIRED', ?, ?)`,
        [appId, inspectorId, `Physical site examination scheduled for ${scheduledDate}`]
      );

      await conn.commit();
      return this.findById(inspectionId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async complete(id, outcome, summaryNotes, inspectorId) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE inspections SET outcome = ?, summary_notes = ?, completed_date = NOW() WHERE id = ?`,
        [outcome, summaryNotes, id]
      );

      const [rows] = await conn.execute('SELECT application_id FROM inspections WHERE id = ?', [id]);
      if (rows.length > 0) {
        const appId = rows[0].application_id;
        const nextStatus = outcome === 'PASSED' ? 'UNDER_REVIEW' : outcome === 'REQUIRES_FOLLOWUP' ? 'CORRECTION_REQUIRED' : 'REJECTED';
        
        await conn.execute(
          `UPDATE applications SET status = ?, updated_at = NOW() WHERE id = ?`,
          [nextStatus, appId]
        );

        await conn.execute(
          `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, remarks)
           VALUES (?, 'INSPECTION_REQUIRED', ?, ?, ?)`,
          [appId, nextStatus, inspectorId, `Inspection completed with outcome: ${outcome}. ${summaryNotes || ''}`]
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
}

module.exports = new InspectionRepository();
