const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const config = require('./config/server');

const app = express();
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Server is running', timestamp: new Date().toISOString() });
});
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/workspaces', require('./routes/workspace.routes'));
app.use('/api/v1/boards', require('./routes/board.routes'));
app.use('/api/v1/stages', require('./routes/stage.routes'));
app.use('/api/v1/cards', require('./routes/card.routes'));
app.use('/api/v1/comments', require('./routes/comment.routes'));
app.use('/api/v1/ai', require('./routes/ai.routes'));

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});
app.use((err, req, res, next) => {
  // Parser errors can include request bodies; provider errors can include mail
  // payloads. Neither error objects nor stacks are safe to log for recovery.
  // Match Express's default case-insensitive, optional-trailing-slash routing,
  // including parser failures that occur before the auth router is reached.
  const recoveryRequest = /^\/api\/v1\/auth\/(forgot-password|reset-password)\/?$/i.test(req.path);
  if (recoveryRequest) {
    console.error('Password reset request error');
    return res.status(err.status || 500).json({
      status: 'error', message: 'Unable to process request',
    });
  }
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(config.env === 'development' && { stack: err.stack }),
  });
});
module.exports = app;
