require('dotenv').config();
const { readRecoveryConfig } = require('./recovery');

const parseCorsOrigin = (origin) => {
  if (!origin || origin === '*') return '*';
  if (origin.includes(',')) return origin.split(',').map(o => o.trim());
  return origin;
};

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  recovery: readRecoveryConfig(),
};
