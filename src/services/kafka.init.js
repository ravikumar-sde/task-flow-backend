const workspaceDeletionConsumer = require('./kafka.consumers/workspace-deletion.consumer');
const kafkaProducer = require('./kafka.producer');

class KafkaInitializer {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Kafka is already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Kafka...');

      // Initialize producer
      await kafkaProducer.init();

      // Start all consumers
      await workspaceDeletionConsumer.start();

      this.isInitialized = true;
      console.log('✅ Kafka initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Kafka:', error);
      // Don't throw - allow the app to start even if Kafka is not available
      // This makes the app more resilient
      console.warn('⚠️  Application will continue without Kafka. Some features may not work.');
    }
  }

  async shutdown() {
    try {
      console.log('Shutting down Kafka...');
      
      await workspaceDeletionConsumer.stop();
      
      const kafkaConfig = require('../config/kafka.config');
      await kafkaConfig.disconnect();
      
      this.isInitialized = false;
      console.log('Kafka shutdown complete');
    } catch (error) {
      console.error('Error shutting down Kafka:', error);
    }
  }
}

// Singleton instance
const kafkaInitializer = new KafkaInitializer();

module.exports = kafkaInitializer;

