const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/server');

// Connect to database
connectDB();

// Start server
const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`Server is running in ${config.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

