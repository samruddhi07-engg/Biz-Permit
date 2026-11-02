const express = require('express');
const router = express.Router();
const appRepo = require('../repositories/application.repository');
const inspectionRepo = require('../repositories/inspection.repository');
const { authenticate } = require('../middleware/authenticate');
const { authorizeRoles } = require('../middleware/authorize');

router.use(authenticate);
router.use(authorizeRoles('OFFICER', 'INSPECTOR', 'ADMIN'));

// GET /api/staff/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const isOfficer = req.user.roles.includes('OFFICER') || req.user.roles.includes('ADMIN');
    const isInspector = req.user.roles.includes('INSPECTOR') || req.user.roles.includes('ADMIN');

    const assignedApps = isOfficer
      ? await appRepo.getAll({ assignedTo: req.user.id })
      : [];

    const pendingReview = isOfficer
      ? await appRepo.getAll({ status: 'UNDER_REVIEW' })
      : [];

    const correctionApps = isOfficer
      ? await appRepo.getAll({ status: 'CORRECTION_REQUIRED' })
      : [];

    const inspections = isInspector
      ? await inspectionRepo.getAll({ inspectorId: req.user.id })
      : [];

    res.json({
      success: true,
      data: {
        assignedCount: assignedApps.length,
        pendingReviewCount: pendingReview.length,
        correctionCount: correctionApps.length,
        inspectionsCount: inspections.length,
        recentAssigned: assignedApps.slice(0, 5),
        recentInspections: inspections.slice(0, 5)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/assigned-applications
router.get('/assigned-applications', async (req, res, next) => {
  try {
    const apps = await appRepo.getAll({ assignedTo: req.user.id });
    res.json({ success: true, data: apps });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
