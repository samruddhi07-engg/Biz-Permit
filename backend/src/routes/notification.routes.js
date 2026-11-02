const express = require('express');
const router = express.Router();
const notifRepo = require('../repositories/notification.repository');
const { authenticate } = require('../middleware/authenticate');

// GET /api/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const list = await notifRepo.getByUser(req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await notifRepo.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await notifRepo.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
