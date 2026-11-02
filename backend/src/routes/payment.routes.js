const express = require('express');
const router = express.Router();
const paymentRepo = require('../repositories/payment.repository');
const auditLogRepo = require('../repositories/audit-log.repository');
const notificationRepo = require('../repositories/notification.repository');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

// GET /api/payments - Get payments list
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      search: req.query.search,
      ownerId: req.query.ownerId
    };
    const payments = await paymentRepo.getAll(filters, req.user);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/stats - Financial KPIs
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await paymentRepo.getStats(req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Get single payment & receipt details
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await paymentRepo.findById(req.params.id, req.user);
    if (!payment) {
      return res.status(404).json({ success: false, error: { message: 'Payment record not found.' } });
    }
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/simulate - Secure simulated payment execution
router.post('/simulate', async (req, res, next) => {
  try {
    const { applicationId } = req.body;
    if (!applicationId) {
      return res.status(400).json({ success: false, error: { message: 'Application ID is required.' } });
    }

    const payment = await paymentRepo.createSimulatedPayment(applicationId, req.user.id);

    await auditLogRepo.log(req.user.id, 'SIMULATE_PAYMENT', 'APPLICATION_PAYMENT', payment.id, {
      applicationId,
      amount: payment.amount,
      transactionReference: payment.transactionReference
    });

    await notificationRepo.create(
      req.user.id,
      'Treasury Fee Payment Received',
      `Payment reference ${payment.transactionReference} for ₹${payment.amount} has been successfully recorded.`,
      'SUCCESS',
      '/owner/payments.html'
    );

    res.status(201).json({
      success: true,
      message: 'Payment simulated successfully under statutory test regulations.',
      data: payment
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

