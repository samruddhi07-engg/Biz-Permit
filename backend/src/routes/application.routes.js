const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const appRepo = require('../repositories/application.repository');
const appService = require('../services/application.service');
const { authenticate } = require('../middleware/authenticate');
const { authorizeRoles } = require('../middleware/authorize');
const { upload, uploadDir } = require('../middleware/upload');

// GET /api/applications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isOwnerOnly = !req.user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    const filters = { ...req.query };

    if (isOwnerOnly) {
      filters.ownerId = req.user.id;
    }

    const apps = await appRepo.getAll(filters);
    res.json({ success: true, data: apps });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const app = await appService.getApplication(req.params.id, req.user);
    res.json({ success: true, data: app });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications (Draft creation)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { businessId, licenseTypeId, applicationType, parentLicenseId, formData } = req.body;
    if (!businessId || !licenseTypeId) {
      return res.status(400).json({ success: false, error: { message: 'Business and license type are required.' } });
    }

    const app = await appService.createApplication({
      businessId,
      licenseTypeId,
      applicationType,
      parentLicenseId,
      formData
    }, req.user.id);

    res.status(201).json({ success: true, data: app });
  } catch (err) {
    next(err);
  }
});

// PUT /api/applications/:id/form (Update dynamic MongoDB form data)
router.put('/:id/form', authenticate, async (req, res, next) => {
  try {
    const updatedData = await appService.saveFormData(req.params.id, req.body.formData || req.body, req.user.id);
    res.json({ success: true, data: updatedData });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/documents (Upload document)
router.post('/:id/documents', authenticate, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded.' } });
    }

    const requirementCode = req.body.requirementCode || 'GENERAL';
    const doc = await appService.uploadDocument(req.params.id, req.file, requirementCode, req.user.id);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/documents/my-vault (Owner Document Vault)
router.get('/documents/my-vault', authenticate, async (req, res, next) => {
  try {
    const result = await appService.getMyDocumentVault(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/documents/vault-upload (Direct upload to vault)
router.post('/documents/vault-upload', authenticate, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded.' } });
    }
    const { category, applicationId } = req.body;
    const doc = await appService.uploadVaultDocument(req.file, category, applicationId, req.user.id);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/:id/documents
router.get('/:id/documents', authenticate, async (req, res, next) => {
  try {
    const docs = await appService.getDocuments(req.params.id, req.user);
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/applications/documents/:docId
router.delete('/documents/:docId', authenticate, async (req, res, next) => {
  try {
    await appService.deleteDocument(req.params.docId, req.user.id, req.user.roles);
    res.json({ success: true, message: 'Document successfully removed.' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/applications/documents/:docId/verify (Officer verification)
router.patch('/documents/:docId/verify', authenticate, authorizeRoles('OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Status must be VERIFIED or REJECTED.' } });
    }

    const doc = await appService.verifyDocument(req.params.docId, status, reviewNotes, req.user.id);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/submit
router.post('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const paymentRef = req.body.transactionReference || null;
    const submitted = await appService.submitApplication(req.params.id, req.user.id, paymentRef);
    res.json({ success: true, data: submitted });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/request-corrections (Officer requests corrections)
router.post('/:id/request-corrections', authenticate, authorizeRoles('OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { remarks } = req.body;
    if (!remarks) {
      return res.status(400).json({ success: false, error: { message: 'Correction remarks are required.' } });
    }

    const updated = await appService.requestCorrections(req.params.id, remarks, req.user.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/applications/:id/decision (Officer decision)
router.post('/:id/decision', authenticate, authorizeRoles('OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { decision, remarks } = req.body;
    const result = await appService.recordDecision(req.params.id, decision, remarks, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/download/:storageKey (Protected file download with ownership verification)
router.get('/download/:storageKey', authenticate, async (req, res, next) => {
  try {
    const safeFilename = path.basename(req.params.storageKey);
    const filePath = path.resolve(uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: { message: 'File not found on server.' } });
    }

    // Role-based access and ownership check
    const { ApplicationDocument } = require('../config/mongodb');
    const doc = await ApplicationDocument.findOne({ storageKey: safeFilename });
    const isStaffOrAdmin = req.user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));

    if (doc) {
      if (!isStaffOrAdmin && doc.uploadedBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied: You are not authorized to view or download this document.' }
        });
      }
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFilename || safeFilename)}"`);
    } else if (!isStaffOrAdmin) {
      return res.status(403).json({ success: false, error: { message: 'Access denied.' } });
    }

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
