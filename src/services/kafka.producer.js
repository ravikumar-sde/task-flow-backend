const kafkaConfig = require('../config/kafka.config');

class KafkaProducer {
  constructor() {
    this.producer = null;
  }

  async init() {
    try {
      this.producer = await kafkaConfig.getProducer();
    } catch (error) {
      console.error('Failed to initialize Kafka producer:', error);
      throw error;
    }
  }

  async publishEvent(topic, event) {
    try {
      if (!this.producer) {
        await this.init();
      }

      const message = {
        topic,
        messages: [
          {
            key: event.key || event.id || Date.now().toString(),
            value: JSON.stringify(event),
            timestamp: Date.now().toString(),
          },
        ],
      };

      const result = await this.producer.send(message);
      console.log(`📤 Event published to topic "${topic}":`, {
        key: message.messages[0].key,
        eventType: event.type,
      });
      
      return result;
    } catch (error) {
      console.error(`Failed to publish event to topic "${topic}":`, error);
      throw error;
    }
  }

  async publishWorkspaceDeletionEvent(workspaceId, userId) {
    const event = {
      type: 'WORKSPACE_DELETED',
      id: workspaceId,
      key: workspaceId,
      data: {
        workspaceId,
        userId,
        timestamp: new Date().toISOString(),
      },
    };

    return this.publishEvent('workspace-events', event);
  }
}

// Singleton instance
const kafkaProducer = new KafkaProducer();

module.exports = kafkaProducer;

