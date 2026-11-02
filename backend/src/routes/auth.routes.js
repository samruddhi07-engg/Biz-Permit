const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/authenticate');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, error: { message: 'Full name, email, and password are required.' } });
    }
    const result = await authService.register({ fullName, email, phone, password });
    
    res.cookie('bizpermit_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: { message: 'Email and password are required.' } });
    }
    const result = await authService.login(email, password);

    res.cookie('bizpermit_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('bizpermit_token');
  res.json({ success: true, message: 'Successfully signed out.' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'Email address is required.' } });
    }
    const result = await authService.forgotPassword(email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: { message: 'Email, code, and new password are required.' } });
    }
    const result = await authService.resetPassword(email, code, newPassword);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const userRepo = require('../repositories/user.repository');
    const { fullName, phone } = req.body;
    const updated = await userRepo.updateProfile(req.user.id, { fullName, phone });
    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/password
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { message: 'Old and new passwords required.' } });
    }
    await authService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
