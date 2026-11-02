const jwt = require('jsonwebtoken');
const { query } = require('../config/mysql');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'bizpermit_jwt_super_secret_key_2026_academic_demo';

async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.bizpermit_token) {
      token = req.cookies.bizpermit_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired session. Please sign in again.', code: 'TOKEN_EXPIRED' }
      });
    }

    // Fetch user and roles from MySQL
    const users = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active 
       FROM users u 
       WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: { message: 'User account not found or deactivated.', code: 'USER_NOT_FOUND' }
      });
    }

    const user = users[0];
    const rolesRows = await query('SELECT role FROM user_roles WHERE user_id = ?', [user.id]);
    user.roles = rolesRows.map(r => r.role);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Optional authentication: sets req.user if present, proceeds if not
async function optionalAuth(req, res, next) {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.bizpermit_token) {
      token = req.cookies.bizpermit_token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await query('SELECT id, full_name, email, is_active FROM users WHERE id = ?', [decoded.userId]);
    if (users.length > 0) {
      const user = users[0];
      const rolesRows = await query('SELECT role FROM user_roles WHERE user_id = ?', [user.id]);
      user.roles = rolesRows.map(r => r.role);
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  JWT_SECRET
};
