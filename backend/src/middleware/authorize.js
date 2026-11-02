/**
 * Role-Based Access Control and Ownership Middleware
 */

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
      });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
          code: 'FORBIDDEN'
        }
      });
    }

    next();
  };
}

module.exports = {
  authorizeRoles
};
