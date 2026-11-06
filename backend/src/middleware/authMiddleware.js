import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'documind_jwt_secret_dev_key_change_in_production';

/**
 * Express middleware to authenticate requests via JWT Bearer token.
 * Validates the Authorization header, verifies the token signature/expiry,
 * and attaches { userId, email } to req.user for downstream handlers.
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check presence and Bearer format of Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No valid authentication token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. Token is missing.',
      });
    }

    // Verify token using JWT secret
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach verified user ID and email to req.user
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    // Specific, safe messages without exposing internal stack traces or secrets
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token has expired. Please log in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token.',
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Authentication failed.',
    });
  }
};

export default authMiddleware;
