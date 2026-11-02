const { query } = require('../config/mysql');

class AuditLogRepository {
  async log(userId, action, entityType, entityId, details = null, ipAddress = '127.0.0.1') {
    try {
      const detailsJson = details ? JSON.stringify(details) : null;
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId || null, action, entityType, String(entityId), detailsJson, ipAddress]
      );
    } catch (err) {
      console.warn('[Audit Log Warning]:', err.message);
    }
  }

  async getAll(filters = {}) {
    let sql = `
      SELECT al.*, u.full_name AS user_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.action) {
      conditions.push('al.action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('al.entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.search) {
      conditions.push('(al.action LIKE ? OR al.entity_type LIKE ? OR al.entity_id LIKE ? OR u.full_name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY al.created_at DESC LIMIT 100';
    const rows = await query(sql, params);
    return rows.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
    }));
  }
}

module.exports = new AuditLogRepository();
