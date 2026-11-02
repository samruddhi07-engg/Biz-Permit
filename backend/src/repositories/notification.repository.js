const { query } = require('../config/mysql');

class NotificationRepository {
  async getByUser(userId) {
    return await query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
  }

  async markAsRead(id, userId) {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }

  async markAllAsRead(userId) {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
    return true;
  }

  async create(userId, title, message, type = 'INFO', linkUrl = null) {
    const res = await query(
      `INSERT INTO notifications (user_id, title, message, notification_type, link_url)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, linkUrl]
    );
    return res.insertId;
  }
}

module.exports = new NotificationRepository();
