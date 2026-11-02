const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middleware/error-handler');

// Route Imports
const authRoutes = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const licenseTypeRoutes = require('./routes/license-type.routes');
const applicationRoutes = require('./routes/application.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const licenseRoutes = require('./routes/license.routes');
const notificationRoutes = require('./routes/notification.routes');
const paymentRoutes = require('./routes/payment.routes');
const staffRoutes = require('./routes/staff.routes');
const ownerRoutes = require('./routes/owner.routes');
const adminRoutes = require('./routes/admin.routes');

// Health check configs
const mysql = require('./config/mysql');
const mongo = require('./config/mongodb');
const neo4j = require('./config/neo4j');
const redis = require('./config/redis');

const app = express();

// Security and utility middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate Limiting on authentication endpoints (50 requests per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: { message: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' } }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve static frontend assets
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// System Health API (Checks all 4 databases)
app.get('/api/health', async (req, res) => {
  const [mysqlRes, mongoRes, neo4jRes, redisRes] = await Promise.all([
    mysql.testConnection(),
    mongo.testConnection(),
    neo4j.testConnection(),
    redis.testConnection()
  ]);

  const allHealthy = [mysqlRes, mongoRes, neo4jRes, redisRes].every(r => r.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    databases: {
      mysql: mysqlRes,
      mongodb: mongoRes,
      neo4j: neo4jRes,
      redis: redisRes
    }
  });
});

// Mount API Modules
app.use('/api/auth', authRoutes);
app.use('/api/business-categories', (req, res, next) => {
  req.url = '/categories' + req.url;
  businessRoutes(req, res, next);
});
app.use('/api/businesses', businessRoutes);
app.use('/api/license-types', licenseTypeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
