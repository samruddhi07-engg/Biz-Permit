const express = require('express');
const router = express.Router();
const inspectionRepo = require('../repositories/inspection.repository');
const { InspectionReport } = require('../config/mongodb');
const { authenticate } = require('../middleware/authenticate');
const { authorizeRoles } = require('../middleware/authorize');
const auditLogRepo = require('../repositories/audit-log.repository');
const notificationRepo = require('../repositories/notification.repository');
const redisService = require('../services/redis.service');

// GET /api/inspections
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {};
    if (req.user.roles.includes('INSPECTOR') && !req.user.roles.includes('ADMIN')) {
      filters.inspectorId = req.user.id;
    }
    if (req.query.outcome) filters.outcome = req.query.outcome;

    const list = await inspectionRepo.getAll(filters);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const inspection = await inspectionRepo.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, error: { message: 'Inspection not found.' } });
    }

    // Retrieve detailed checklist from MongoDB
    const report = await InspectionReport.findOne({ inspectionId: inspection.id });
    inspection.detailedReport = report || null;

    res.json({ success: true, data: inspection });
  } catch (err) {
    next(err);
  }
});

// POST /api/inspections (Schedule inspection)
router.post('/', authenticate, authorizeRoles('OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { applicationId, inspectorId, scheduledDate, notes } = req.body;
    if (!applicationId || !inspectorId || !scheduledDate) {
      return res.status(400).json({ success: false, error: { message: 'Application, inspector, and date are required.' } });
    }

    const inspection = await inspectionRepo.schedule(applicationId, inspectorId, scheduledDate, notes);

    // Seed initial MongoDB Checklist structure
    await InspectionReport.findOneAndUpdate(
      { inspectionId: inspection.id },
      {
        inspectionId: inspection.id,
        applicationId,
        inspectorId,
        checklist: [
          { itemId: 'INSP-01', title: 'Premises Structural & Life Safety Verification', status: 'PASS', remarks: '' },
          { itemId: 'INSP-02', title: 'Emergency Egress & Exit Route Clearance', status: 'PASS', remarks: '' },
          { itemId: 'INSP-03', title: 'Utility, Water & Sanitation Infrastructure', status: 'PASS', remarks: '' },
          { itemId: 'INSP-04', title: 'Fire Extinguisher & First-Aid Provision', status: 'PASS', remarks: '' },
          { itemId: 'INSP-05', title: 'Commercial Environmental Standards Compliance', status: 'PASS', remarks: '' }
        ],
        evidenceMetadata: [],
        remarks: notes || ''
      },
      { upsert: true, new: true }
    );

    await auditLogRepo.log(req.user.id, 'SCHEDULE_INSPECTION', 'INSPECTION', inspection.id, {
      applicationId,
      inspectorId,
      scheduledDate
    });

    await notificationRepo.create(
      inspectorId,
      'New Inspection Assigned',
      `You have been assigned to conduct an on-site audit for Application #${applicationId} on ${scheduledDate}.`,
      'INFO',
      `/staff/inspection-details.html?id=${inspection.id}`
    );

    await redisService.invalidateWorkflowCaches();

    res.status(201).json({ success: true, data: inspection });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/inspections/:id (Complete inspection)
router.patch('/:id', authenticate, authorizeRoles('INSPECTOR', 'OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { outcome, summaryNotes, checklist, evidenceMetadata } = req.body;
    if (!['PASSED', 'FAILED', 'REQUIRES_FOLLOWUP'].includes(outcome)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid outcome value.' } });
    }

    const updated = await inspectionRepo.complete(req.params.id, outcome, summaryNotes, req.user.id);

    // Update MongoDB report
    if (checklist || evidenceMetadata || summaryNotes) {
      await InspectionReport.findOneAndUpdate(
        { inspectionId: parseInt(req.params.id, 10) },
        {
          ...(checklist && { checklist }),
          ...(evidenceMetadata && { evidenceMetadata }),
          ...(summaryNotes && { remarks: summaryNotes })
        },
        { upsert: true }
      );
    }

    await auditLogRepo.log(req.user.id, 'COMPLETE_INSPECTION', 'INSPECTION', req.params.id, { outcome });
    await redisService.invalidateWorkflowCaches();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
