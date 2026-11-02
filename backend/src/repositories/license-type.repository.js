const { query, getConnection } = require('../config/mysql');

class LicenseTypeRepository {
  async getDepartments() {
    return await query(`
      SELECT d.*, 
             COUNT(DISTINCT lt.id) AS license_types_count,
             COUNT(DISTINCT sd.user_id) AS staff_count
      FROM departments d
      LEFT JOIN license_types lt ON d.id = lt.department_id AND lt.is_active = TRUE
      LEFT JOIN staff_departments sd ON d.id = sd.department_id
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
  }

  async getDepartmentById(id) {
    const rows = await query('SELECT * FROM departments WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async createDepartment(deptData) {
    const res = await query(
      'INSERT INTO departments (code, name, contact_email, contact_phone, office_location, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [deptData.code, deptData.name, deptData.contactEmail || null, deptData.contactPhone || null, deptData.officeLocation || null, true]
    );
    return this.getDepartmentById(res.insertId);
  }

  async updateDepartment(id, deptData) {
    await query(
      'UPDATE departments SET name = ?, contact_email = ?, contact_phone = ?, office_location = ?, is_active = ? WHERE id = ?',
      [deptData.name, deptData.contactEmail, deptData.contactPhone, deptData.officeLocation, deptData.isActive !== false, id]
    );
    return this.getDepartmentById(id);
  }

  async getAllLicenseTypes(filters = {}) {
    let sql = `
      SELECT lt.*, d.name AS department_name, d.code AS department_code,
             GROUP_CONCAT(DISTINCT bc.name SEPARATOR ' | ') AS categories_str,
             GROUP_CONCAT(DISTINCT bc.id SEPARATOR ',') AS category_ids_str
      FROM license_types lt
      JOIN departments d ON lt.department_id = d.id
      LEFT JOIN license_type_categories ltc ON lt.id = ltc.license_type_id
      LEFT JOIN business_categories bc ON ltc.category_id = bc.id
    `;
    const params = [];
    const conditions = [];

    if (filters.isActive !== undefined) {
      conditions.push('lt.is_active = ?');
      params.push(filters.isActive);
    } else {
      conditions.push('lt.is_active = TRUE');
    }

    if (filters.search) {
      conditions.push('(lt.name LIKE ? OR lt.code LIKE ? OR lt.description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.departmentId) {
      conditions.push('lt.department_id = ?');
      params.push(filters.departmentId);
    }

    if (filters.maxFee) {
      conditions.push('lt.fee <= ?');
      params.push(filters.maxFee);
    }

    if (filters.validityMonths) {
      conditions.push('lt.validity_months = ?');
      params.push(filters.validityMonths);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY lt.id';

    if (filters.sortBy === 'fee_asc') sql += ' ORDER BY lt.fee ASC';
    else if (filters.sortBy === 'fee_desc') sql += ' ORDER BY lt.fee DESC';
    else if (filters.sortBy === 'name') sql += ' ORDER BY lt.name ASC';
    else sql += ' ORDER BY lt.id ASC';

    const rows = await query(sql, params);
    let results = rows.map(r => ({
      ...r,
      fee: parseFloat(r.fee),
      categories: r.categories_str ? r.categories_str.split(' | ') : [],
      categoryIds: r.category_ids_str ? r.category_ids_str.split(',').map(Number) : []
    }));

    if (filters.categoryId) {
      const catId = parseInt(filters.categoryId, 10);
      results = results.filter(r => r.categoryIds.includes(catId));
    }

    return results;
  }

  async findById(id) {
    const rows = await query(
      `SELECT lt.*, d.name AS department_name, d.code AS department_code, d.contact_email AS department_email
       FROM license_types lt
       JOIN departments d ON lt.department_id = d.id
       WHERE lt.id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    const license = rows[0];
    license.fee = parseFloat(license.fee);

    // Categories
    const categories = await query(
      `SELECT bc.* FROM business_categories bc
       JOIN license_type_categories ltc ON bc.id = ltc.category_id
       WHERE ltc.license_type_id = ?`,
      [id]
    );
    license.categories = categories;

    // Requirements
    const requirements = await query(
      `SELECT * FROM license_requirements WHERE license_type_id = ? ORDER BY id ASC`,
      [id]
    );
    license.requirements = requirements;

    return license;
  }

  async findByCode(code) {
    const rows = await query('SELECT id FROM license_types WHERE code = ?', [code]);
    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  async create(licenseData) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.execute(
        `INSERT INTO license_types 
          (code, name, department_id, fee, validity_months, processing_sla_days, requires_inspection, description, eligibility_criteria, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          licenseData.code,
          licenseData.name,
          licenseData.departmentId,
          licenseData.fee || 0,
          licenseData.validityMonths || 12,
          licenseData.processingSlaDays || 14,
          licenseData.requiresInspection || false,
          licenseData.description || null,
          licenseData.eligibilityCriteria || null,
          licenseData.isActive !== false
        ]
      );
      const licenseId = res.insertId;

      if (licenseData.categoryIds && licenseData.categoryIds.length > 0) {
        for (const catId of licenseData.categoryIds) {
          await conn.execute('INSERT INTO license_type_categories (license_type_id, category_id) VALUES (?, ?)', [licenseId, catId]);
        }
      }

      await conn.commit();
      return this.findById(licenseId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async update(id, licenseData) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE license_types SET
          name = ?,
          department_id = ?,
          fee = ?,
          validity_months = ?,
          processing_sla_days = ?,
          requires_inspection = ?,
          description = ?,
          eligibility_criteria = ?,
          is_active = ?
         WHERE id = ?`,
        [
          licenseData.name,
          licenseData.departmentId,
          licenseData.fee,
          licenseData.validityMonths,
          licenseData.processingSlaDays,
          licenseData.requiresInspection,
          licenseData.description,
          licenseData.eligibilityCriteria,
          licenseData.isActive !== false,
          id
        ]
      );

      if (licenseData.categoryIds) {
        await conn.execute('DELETE FROM license_type_categories WHERE license_type_id = ?', [id]);
        for (const catId of licenseData.categoryIds) {
          await conn.execute('INSERT INTO license_type_categories (license_type_id, category_id) VALUES (?, ?)', [id, catId]);
        }
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

  async addRequirement(reqData) {
    const sql = `
      INSERT INTO license_requirements (license_type_id, requirement_code, title, description, document_type, is_mandatory, allowed_extensions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await query(sql, [
      reqData.licenseTypeId,
      reqData.requirementCode,
      reqData.title,
      reqData.description || null,
      reqData.documentType,
      reqData.isMandatory !== false,
      reqData.allowedExtensions || 'pdf,jpg,jpeg,png'
    ]);
    return res.insertId;
  }

  async deleteRequirement(id) {
    await query('DELETE FROM license_requirements WHERE id = ?', [id]);
    return true;
  }
}

module.exports = new LicenseTypeRepository();
