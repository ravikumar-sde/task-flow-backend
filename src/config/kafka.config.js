const { Kafka, logLevel } = require('kafkajs');

class KafkaConfig {
  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'trello-backend',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = null;
    this.consumers = new Map();
  }

  async getProducer() {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });
      await this.producer.connect();
      console.log('✅ Kafka Producer connected');
    }
    return this.producer;
  }

  async createConsumer(groupId, topics) {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: false });
    
    this.consumers.set(groupId, consumer);
    console.log(`✅ Kafka Consumer connected - Group: ${groupId}, Topics: ${topics.join(', ')}`);
    
    return consumer;
  }

  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        console.log('Kafka Producer disconnected');
      }

      for (const [groupId, consumer] of this.consumers.entries()) {
        await consumer.disconnect();
        console.log(`Kafka Consumer disconnected - Group: ${groupId}`);
      }
    } catch (error) {
      console.error('Error disconnecting Kafka:', error);
    }
  }
}

// Singleton instance
const kafkaConfig = new KafkaConfig();

module.exports = kafkaConfig;

