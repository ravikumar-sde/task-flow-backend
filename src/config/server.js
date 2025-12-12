require('dotenv').config();

// Parse CORS origin - supports single origin, multiple origins (comma-separated), or wildcard
const parseCorsOrigin = (origin) => {
  if (!origin || origin === '*') {
    return '*';
  }

  // If multiple origins are provided (comma-separated), return as array
  if (origin.includes(',')) {
    return origin.split(',').map(o => o.trim());
  }

  // Single origin
  return origin;
};

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '7d',
};

