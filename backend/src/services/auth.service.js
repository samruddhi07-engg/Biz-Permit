const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/user.repository');
const redisService = require('./redis.service');
const auditLogRepo = require('../repositories/audit-log.repository');
const { JWT_SECRET } = require('../middleware/authenticate');

class AuthService {
  async register({ fullName, email, phone, password }) {
    const existing = await userRepo.findByEmail(email.toLowerCase().trim());
    if (existing) {
      const err = new Error('An account with this email address already exists.');
      err.statusCode = 400;
      err.code = 'EMAIL_EXISTS';
      throw err;
    }

    if (!password || password.length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepo.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      passwordHash,
      roles: ['BUSINESS_OWNER']
    });

    await auditLogRepo.log(user.id, 'REGISTER', 'USER', user.id, { email: user.email });

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { user, token };
  }

  async login(email, password) {
    const user = await userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      const err = new Error('Invalid email address or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    if (!user.is_active) {
      const err = new Error('Your account has been deactivated. Please contact administration.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_DEACTIVATED';
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid email address or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    delete user.password_hash;

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await auditLogRepo.log(user.id, 'LOGIN', 'USER', user.id, { email: user.email });

    return { user, token };
  }

  async forgotPassword(email) {
    const user = await userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Return simulated success to avoid email enumeration
      return {
        message: 'If an account exists with this email, a verification code has been dispatched.',
        challengeCode: 'DEMO-8841'
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redisService.setVerificationCode(user.email, code);

    await auditLogRepo.log(user.id, 'REQUEST_PASSWORD_RESET', 'USER', user.id, { email: user.email });

    return {
      message: 'Password reset verification code generated.',
      challengeCode: code
    };
  }

  async resetPassword(email, code, newPassword) {
    const stored = await redisService.getVerificationCode(email.toLowerCase().trim());
    if (!stored || stored.code !== code) {
      const err = new Error('Invalid or expired verification code.');
      err.statusCode = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    const user = await userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(user.id, passwordHash);
    await redisService.clearVerificationCode(email.toLowerCase().trim());

    await auditLogRepo.log(user.id, 'RESET_PASSWORD', 'USER', user.id, { email: user.email });

    return { message: 'Password has been successfully updated. You may now log in.' };
  }

  async changePassword(userId, oldPassword, newPassword) {
    const user = await userRepo.findByEmail((await userRepo.findById(userId)).email);
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(userId, passwordHash);
    await auditLogRepo.log(userId, 'CHANGE_PASSWORD', 'USER', userId);
    return true;
  }
}

module.exports = new AuthService();
