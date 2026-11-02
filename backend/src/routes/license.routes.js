const express = require('express');
const router = express.Router();
const issuedLicenseRepo = require('../repositories/issued-license.repository');
const { authenticate, optionalAuth } = require('../middleware/authenticate');
const auditLogRepo = require('../repositories/audit-log.repository');
const redisService = require('../services/redis.service');

// GET /api/licenses
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isOwnerOnly = !req.user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    const filters = { ...req.query };

    if (isOwnerOnly) {
      filters.ownerId = req.user.id;
    }

    const licenses = await issuedLicenseRepo.getAll(filters);
    res.json({ success: true, data: licenses });
  } catch (err) {
    next(err);
  }
});

// GET /api/licenses/verify/:qrCode (PUBLIC QR verification)
router.get('/verify/:qrCode', async (req, res, next) => {
  try {
    const license = await issuedLicenseRepo.findByQrCode(req.params.qrCode);
    if (!license) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or unrecognized permit verification token.', code: 'NOT_FOUND' }
      });
    }

    res.json({
      success: true,
      data: {
        verified: true,
        licenseNumber: license.license_number,
        businessName: license.business_name,
        licenseName: license.license_name,
        departmentName: license.department_name,
        issueDate: license.issue_date,
        expiryDate: license.expiry_date,
        status: license.status,
        jurisdiction: 'Civic Metro Municipal Licensure Board'
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/licenses/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const license = await issuedLicenseRepo.findById(req.params.id);
    if (!license) {
      return res.status(404).json({ success: false, error: { message: 'License not found.' } });
    }

    const isOwner = license.owner_id === req.user.id;
    const isStaff = req.user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized.' } });
    }

    res.json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

// POST /api/licenses/:id/renewals
router.post('/:id/renewals', authenticate, async (req, res, next) => {
  try {
    const newAppId = await issuedLicenseRepo.createRenewal(req.params.id, req.user.id);
    await auditLogRepo.log(req.user.id, 'INITIATE_RENEWAL', 'APPLICATION', newAppId, {
      parentLicenseId: req.params.id
    });
    await redisService.invalidateWorkflowCaches(req.user.id);

    res.status(201).json({
      success: true,
      data: {
        applicationId: newAppId,
        message: 'Renewal application draft initiated.'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
