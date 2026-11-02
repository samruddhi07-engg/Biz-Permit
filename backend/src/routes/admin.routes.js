const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/user.repository');
const licenseRepo = require('../repositories/license-type.repository');
const appRepo = require('../repositories/application.repository');
const auditLogRepo = require('../repositories/audit-log.repository');
const neo4jService = require('../services/neo4j.service');
const redisService = require('../services/redis.service');
const { authenticate } = require('../middleware/authenticate');
const { authorizeRoles } = require('../middleware/authorize');
const inspectionRepo = require('../repositories/inspection.repository');
const { query } = require('../config/mysql');

// All admin routes require ADMIN or OFFICER role where appropriate
router.use(authenticate);

// GET /api/admin/dashboard
router.get('/dashboard', authorizeRoles('ADMIN', 'OFFICER'), async (req, res, next) => {
  try {
    const cached = await redisService.getAdminDashboardCache();
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const metrics = await appRepo.getMetrics();
    const departmentWorkload = await query(`
      SELECT d.name AS department_name, d.code AS department_code,
             COUNT(a.id) AS total_applications,
             SUM(CASE WHEN a.status IN ('SUBMITTED', 'UNDER_REVIEW') THEN 1 ELSE 0 END) AS pending_adjudication
      FROM departments d
      LEFT JOIN license_types lt ON d.id = lt.department_id
      LEFT JOIN applications a ON lt.id = a.license_type_id
      GROUP BY d.id
    `);

    const monthlyTrends = await query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') AS month_label,
             COUNT(*) AS applications_count,
             SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count
      FROM applications
      GROUP BY DATE_FORMAT(created_at, '%b %Y'), YEAR(created_at), MONTH(created_at)
      ORDER BY YEAR(created_at) DESC, MONTH(created_at) DESC
      LIMIT 6
    `);

    const recentAudit = await auditLogRepo.getAll();

    const data = {
      metrics,
      departmentWorkload,
      monthlyTrends: monthlyTrends.reverse(),
      recentAudit: recentAudit.slice(0, 8)
    };

    await redisService.setAdminDashboardCache(data);

    res.json({ success: true, data, source: 'database' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get('/users', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const users = await userRepo.getAllUsers(req.query);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await userRepo.setActiveStatus(req.params.id, Boolean(isActive));
    await auditLogRepo.log(req.user.id, 'CHANGE_USER_STATUS', 'USER', req.params.id, { isActive });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/roles
router.put('/users/:id/roles', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'At least one role is required.' } });
    }
    const user = await userRepo.assignRoles(req.params.id, roles);
    await auditLogRepo.log(req.user.id, 'CHANGE_USER_ROLES', 'USER', req.params.id, { roles });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff (Create officer/inspector staff account)
router.post('/staff', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, departmentId, designation } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ success: false, error: { message: 'Name, email, password, and role are required.' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepo.create({
      fullName,
      email,
      phone,
      passwordHash,
      roles: [role]
    });

    if (departmentId) {
      await query(
        'INSERT INTO staff_departments (user_id, department_id, designation) VALUES (?, ?, ?)',
        [user.id, departmentId, designation || 'Staff Member']
      );
    }

    await auditLogRepo.log(req.user.id, 'CREATE_STAFF', 'USER', user.id, { role, departmentId });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/license-types (Create license type & sync to Neo4j)
router.post('/license-types', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const license = await licenseRepo.create(req.body);

    // Sync to Neo4j
    try {
      await neo4jService.syncLicenseType(license);
    } catch (neoErr) {
      console.warn('[Neo4j Sync Warning]:', neoErr.message);
    }

    // Invalidate Redis caches
    await redisService.invalidateAllLicenseCaches();
    await auditLogRepo.log(req.user.id, 'CREATE_LICENSE_TYPE', 'LICENSE_TYPE', license.id, { code: license.code });

    res.status(201).json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/license-types/:id (Update license type & sync to Neo4j)
router.put('/license-types/:id', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const license = await licenseRepo.update(req.params.id, req.body);

    // Sync to Neo4j
    try {
      await neo4jService.syncLicenseType(license);
    } catch (neoErr) {
      console.warn('[Neo4j Sync Warning]:', neoErr.message);
    }

    await redisService.invalidateAllLicenseCaches();
    await auditLogRepo.log(req.user.id, 'UPDATE_LICENSE_TYPE', 'LICENSE_TYPE', req.params.id);

    res.json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments
router.post('/departments', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const dept = await licenseRepo.createDepartment(req.body);

    try {
      await neo4jService.syncDepartment(dept);
    } catch (neoErr) {
      console.warn('[Neo4j Sync Warning]:', neoErr.message);
    }

    await auditLogRepo.log(req.user.id, 'CREATE_DEPARTMENT', 'DEPARTMENT', dept.id, { name: dept.name });
    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/requirements
router.get('/requirements', authorizeRoles('ADMIN', 'OFFICER'), async (req, res, next) => {
  try {
    let sql = `
      SELECT lr.*, lt.name AS license_name, lt.code AS license_code
      FROM license_requirements lr
      JOIN license_types lt ON lr.license_type_id = lt.id
    `;
    const params = [];
    if (req.query.licenseTypeId) {
      sql += ' WHERE lr.license_type_id = ?';
      params.push(req.query.licenseTypeId);
    }
    sql += ' ORDER BY lt.name ASC, lr.id ASC';
    const requirements = await query(sql, params);
    res.json({ success: true, data: requirements });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/requirements
router.post('/requirements', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const reqId = await licenseRepo.addRequirement(req.body);
    await auditLogRepo.log(req.user.id, 'CREATE_REQUIREMENT', 'REQUIREMENT', reqId);
    res.status(201).json({ success: true, data: { id: reqId } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/requirements/:id
router.put('/requirements/:id', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { title, description, documentType, isMandatory, allowedExtensions } = req.body;
    await query(
      `UPDATE license_requirements 
       SET title = ?, description = ?, document_type = ?, is_mandatory = ?, allowed_extensions = ?
       WHERE id = ?`,
      [title, description || null, documentType, isMandatory !== false, allowedExtensions || 'pdf,jpg,jpeg,png', req.params.id]
    );
    await auditLogRepo.log(req.user.id, 'UPDATE_REQUIREMENT', 'REQUIREMENT', req.params.id);
    res.json({ success: true, message: 'Requirement updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/requirements/:id
router.delete('/requirements/:id', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    await licenseRepo.deleteRequirement(req.params.id);
    res.json({ success: true, message: 'Requirement deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/applications
router.get('/applications', authorizeRoles('ADMIN', 'OFFICER'), async (req, res, next) => {
  try {
    const apps = await appRepo.getAll(req.query);
    res.json({ success: true, data: apps });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/applications/:id/assign
router.put('/applications/:id/assign', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { officerId, notes } = req.body;
    if (!officerId) {
      return res.status(400).json({ success: false, error: { message: 'Officer ID is required.' } });
    }
    await appRepo.assignOfficer(req.params.id, officerId, req.user.id, notes || 'Reassigned by System Administrator');
    await auditLogRepo.log(req.user.id, 'ASSIGN_APPLICATION', 'APPLICATION', req.params.id, { officerId, notes });
    res.json({ success: true, message: 'Officer assigned successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/inspections
router.get('/inspections', authorizeRoles('ADMIN', 'OFFICER'), async (req, res, next) => {
  try {
    const inspections = await inspectionRepo.getAll(req.query);
    res.json({ success: true, data: inspections });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reports
router.get('/reports', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    // 1. Category Distribution
    const categoryDistribution = await query(`
      SELECT bc.name AS category_name, COUNT(b.id) AS businesses_count
      FROM business_categories bc
      LEFT JOIN businesses b ON bc.id = b.category_id
      GROUP BY bc.id
    `);

    // 2. Application Volume by License Type
    const licenseTypeVolume = await query(`
      SELECT lt.name AS license_name, COUNT(a.id) AS applications_count
      FROM license_types lt
      LEFT JOIN applications a ON lt.id = a.license_type_id
      GROUP BY lt.id
    `);

    // 3. Approval Rate by Month
    const monthlyDecisions = await query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') AS month_label,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
             SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
      FROM applications
      WHERE status IN ('APPROVED', 'REJECTED')
      GROUP BY DATE_FORMAT(created_at, '%b %Y'), YEAR(created_at), MONTH(created_at)
      ORDER BY YEAR(created_at) DESC, MONTH(created_at) DESC
      LIMIT 6
    `);

    // 4. Expiry Timeline (Next 12 months)
    const upcomingExpiries = await query(`
      SELECT DATE_FORMAT(expiry_date, '%b %Y') AS expiry_month, COUNT(*) AS count
      FROM issued_licenses
      WHERE expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(expiry_date, '%b %Y'), YEAR(expiry_date), MONTH(expiry_date)
      ORDER BY YEAR(expiry_date) ASC, MONTH(expiry_date) ASC
    `);

    res.json({
      success: true,
      data: {
        categoryDistribution,
        licenseTypeVolume,
        monthlyDecisions: monthlyDecisions.reverse(),
        upcomingExpiries
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const logs = await auditLogRepo.getAll(req.query);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
