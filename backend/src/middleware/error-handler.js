/**
 * Centralized Application Error Handler
 */
function errorHandler(err, req, res, next) {
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: err.details })
    }
  });
}

module.exports = errorHandler;
