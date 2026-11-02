const { query } = require('../config/mysql');

class BusinessRepository {
  async getCategories() {
    return await query('SELECT * FROM business_categories WHERE is_active = TRUE ORDER BY name ASC');
  }

  async getCategoryByCode(code) {
    const rows = await query('SELECT * FROM business_categories WHERE code = ?', [code]);
    return rows[0] || null;
  }

  async getCategoryById(id) {
    const rows = await query('SELECT * FROM business_categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async findByOwner(ownerId, filters = {}) {
    let sql = `
      SELECT b.*, bc.name AS category_name, bc.code AS category_code,
             COUNT(DISTINCT a.id) AS applications_count,
             COUNT(DISTINCT il.id) AS active_licenses_count
      FROM businesses b
      JOIN business_categories bc ON b.category_id = bc.id
      LEFT JOIN applications a ON b.id = a.business_id
      LEFT JOIN issued_licenses il ON b.id = il.business_id AND il.status = 'ACTIVE'
      WHERE b.owner_id = ?
    `;
    const params = [ownerId];

    if (filters.search) {
      sql += ' AND (b.business_name LIKE ? OR b.registration_number LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.categoryId) {
      sql += ' AND b.category_id = ?';
      params.push(filters.categoryId);
    }

    sql += ' GROUP BY b.id ORDER BY b.created_at DESC';
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(
      `SELECT b.*, bc.name AS category_name, bc.code AS category_code, u.full_name AS owner_name, u.email AS owner_email
       FROM businesses b
       JOIN business_categories bc ON b.category_id = bc.id
       JOIN users u ON b.owner_id = u.id
       WHERE b.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async create(bizData) {
    const sql = `
      INSERT INTO businesses 
        (owner_id, category_id, business_name, registration_number, address_line1, address_line2, city, state, postal_code, contact_email, contact_phone, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      bizData.ownerId,
      bizData.categoryId,
      bizData.businessName,
      bizData.registrationNumber || null,
      bizData.addressLine1,
      bizData.addressLine2 || null,
      bizData.city,
      bizData.state,
      bizData.postalCode,
      bizData.contactEmail || null,
      bizData.contactPhone || null,
      bizData.description || null
    ];
    const res = await query(sql, params);
    return this.findById(res.insertId);
  }

  async update(id, bizData) {
    const sql = `
      UPDATE businesses SET
        category_id = ?,
        business_name = ?,
        registration_number = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        contact_email = ?,
        contact_phone = ?,
        description = ?
      WHERE id = ?
    `;
    const params = [
      bizData.categoryId,
      bizData.businessName,
      bizData.registrationNumber || null,
      bizData.addressLine1,
      bizData.addressLine2 || null,
      bizData.city,
      bizData.state,
      bizData.postalCode,
      bizData.contactEmail || null,
      bizData.contactPhone || null,
      bizData.description || null,
      id
    ];
    await query(sql, params);
    return this.findById(id);
  }

  async delete(id) {
    // Check if businesses have existing applications or licenses
    const apps = await query('SELECT id FROM applications WHERE business_id = ?', [id]);
    if (apps.length > 0) {
      throw new Error('Cannot delete business with existing applications or licenses.');
    }
    await query('DELETE FROM businesses WHERE id = ?', [id]);
    return true;
  }
}

module.exports = new BusinessRepository();
