const express = require('express');
const router = express.Router();
const businessRepo = require('../repositories/business.repository');
const { authenticate } = require('../middleware/authenticate');
const auditLogRepo = require('../repositories/audit-log.repository');

// GET /api/business-categories (public)
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await businessRepo.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/businesses (owner's businesses)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      categoryId: req.query.categoryId
    };
    const businesses = await businessRepo.findByOwner(req.user.id, filters);
    res.json({ success: true, data: businesses });
  } catch (err) {
    next(err);
  }
});

// GET /api/businesses/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const business = await businessRepo.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, error: { message: 'Business not found.' } });
    }

    // Role check: must be owner or staff
    const isOwner = business.owner_id === req.user.id;
    const isStaff = req.user.roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized.' } });
    }

    res.json({ success: true, data: business });
  } catch (err) {
    next(err);
  }
});

// POST /api/businesses
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      businessName,
      categoryId,
      registrationNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      contactEmail,
      contactPhone,
      description
    } = req.body;

    if (!businessName || !categoryId || !addressLine1 || !city || !state || !postalCode) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please complete all required business address and category fields.' }
      });
    }

    const business = await businessRepo.create({
      ownerId: req.user.id,
      categoryId,
      businessName,
      registrationNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      contactEmail,
      contactPhone,
      description
    });

    await auditLogRepo.log(req.user.id, 'CREATE_BUSINESS', 'BUSINESS', business.id, { businessName });

    res.status(201).json({ success: true, data: business });
  } catch (err) {
    next(err);
  }
});

// PUT /api/businesses/:id
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const business = await businessRepo.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, error: { message: 'Business not found.' } });
    }

    if (business.owner_id !== req.user.id && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized.' } });
    }

    const updated = await businessRepo.update(req.params.id, req.body);
    await auditLogRepo.log(req.user.id, 'UPDATE_BUSINESS', 'BUSINESS', req.params.id);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/businesses/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const business = await businessRepo.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ success: false, error: { message: 'Business not found.' } });
    }

    if (business.owner_id !== req.user.id && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized.' } });
    }

    await businessRepo.delete(req.params.id);
    await auditLogRepo.log(req.user.id, 'DELETE_BUSINESS', 'BUSINESS', req.params.id);

    res.json({ success: true, message: 'Business profile successfully deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
