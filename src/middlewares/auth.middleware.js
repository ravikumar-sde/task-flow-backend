const jwt = require('jsonwebtoken');
const UserModel = require('../database/models/UserModel');
const config = require('../config/server');
const { acceptsAccessToken } = require('../utils/session.util');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided. Please login to access this resource.',
      });
    }
    const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
    const user = await UserModel.findById(decoded.id);
    if (!acceptsAccessToken(decoded, user)) {
      return res.status(401).json({ status: 'error', message: 'Session expired. Please login again.' });
    }
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.status === 401 || ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token. Please login again.' });
    }
    return res.status(500).json({ status: 'error', message: 'Authentication failed.' });
  }
};

const optionalAuth = async (req, res, next) => {
  delete req.user;
  delete req.userId;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
      const user = await UserModel.findById(decoded.id);
      if (acceptsAccessToken(decoded, user)) {
        req.user = user;
        req.userId = user._id;
      }
    }
  } catch {
    // Optional authentication proceeds anonymously when validation fails.
  }
  next();
};

module.exports = { authenticate, optionalAuth };
