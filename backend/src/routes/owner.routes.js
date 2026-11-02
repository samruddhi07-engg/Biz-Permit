const express = require('express');
const router = express.Router();
const appRepo = require('../repositories/application.repository');
const redisService = require('../services/redis.service');
const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

// GET /api/owner/dashboard (with Redis caching)
router.get('/dashboard', async (req, res, next) => {
  try {
    const cached = await redisService.getOwnerDashboardCache(req.user.id);
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const data = await appRepo.getOwnerDashboard(req.user.id);
    await redisService.setOwnerDashboardCache(req.user.id, data);

    res.json({ success: true, data, source: 'database' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
