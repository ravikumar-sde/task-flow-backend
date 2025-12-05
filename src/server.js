const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/server');
const kafkaInitializer = require('./services/kafka.init');

// Initialize application
async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Initialize Kafka
    await kafkaInitializer.initialize();

    // Start server
    const PORT = config.port;

    const server = app.listen(PORT, () => {
      console.log(`Server is running in ${config.env} mode on port ${PORT}`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
const serverPromise = startServer();
let server;

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server = await serverPromise;
  await kafkaInitializer.shutdown();
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server = await serverPromise;
  await kafkaInitializer.shutdown();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server = await serverPromise;
  await kafkaInitializer.shutdown();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

