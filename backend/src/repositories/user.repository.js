const { query, getConnection } = require('../config/mysql');

class UserRepository {
  async findById(id) {
    const rows = await query('SELECT id, full_name, email, phone, is_active, created_at FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const user = rows[0];
    const roles = await query('SELECT role FROM user_roles WHERE user_id = ?', [id]);
    user.roles = roles.map(r => r.role);
    return user;
  }

  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return null;
    const user = rows[0];
    const roles = await query('SELECT role FROM user_roles WHERE user_id = ?', [user.id]);
    user.roles = roles.map(r => r.role);
    return user;
  }

  async create(userData) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.execute(
        'INSERT INTO users (full_name, email, phone, password_hash, is_active) VALUES (?, ?, ?, ?, ?)',
        [userData.fullName, userData.email, userData.phone || null, userData.passwordHash, true]
      );
      const userId = res.insertId;
      const roles = userData.roles && userData.roles.length > 0 ? userData.roles : ['BUSINESS_OWNER'];
      for (const role of roles) {
        await conn.execute('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]);
      }
      await conn.commit();
      return this.findById(userId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateProfile(userId, { fullName, phone }) {
    await query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [fullName, phone, userId]);
    return this.findById(userId);
  }

  async updatePassword(userId, passwordHash) {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    return true;
  }

  async getAllUsers(filters = {}) {
    let sql = `
      SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
             GROUP_CONCAT(ur.role SEPARATOR ',') AS roles_str
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
    `;
    const params = [];
    const conditions = [];

    if (filters.search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY u.id ORDER BY u.id DESC';

    const rows = await query(sql, params);
    let results = rows.map(r => ({
      ...r,
      roles: r.roles_str ? r.roles_str.split(',') : []
    }));

    if (filters.role) {
      results = results.filter(u => u.roles.includes(filters.role));
    }

    return results;
  }

  async setActiveStatus(userId, isActive) {
    await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userId]);
    return this.findById(userId);
  }

  async assignRoles(userId, roles) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
      for (const role of roles) {
        await conn.execute('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]);
      }
      await conn.commit();
      return this.findById(userId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new UserRepository();
