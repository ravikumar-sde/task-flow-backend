# Kafka Setup and Configuration

This document explains how to set up and use Kafka for asynchronous workspace deletion in the Trello Backend application.

## 📋 Overview

The application uses Apache Kafka to handle workspace deletion asynchronously. When a workspace is deleted, instead of immediately deleting all related data (boards, stages, cards, comments), the application publishes an event to Kafka. A consumer then processes this event in the background and performs the complete cleanup.

## 🚀 Quick Start

### 1. Start Kafka using Docker Compose

```bash
docker-compose -f docker-compose.kafka.yml up -d
```

This will start:
- **Zookeeper** on port `2181`
- **Kafka** on port `9092`
- **Kafka UI** on port `8080` (http://localhost:8080)

### 2. Verify Kafka is Running

```bash
docker ps
```

You should see three containers running:
- `trello-zookeeper`
- `trello-kafka`
- `trello-kafka-ui`

### 3. Start the Application

```bash
npm run dev
```

The application will automatically:
- Connect to Kafka
- Initialize the producer
- Start the workspace deletion consumer

## 🏗️ Architecture

### Components

1. **Kafka Producer** (`src/services/kafka.producer.js`)
   - Publishes events to Kafka topics
   - Used by workspace use case to publish deletion events

2. **Kafka Consumer** (`src/services/kafka.consumers/workspace-deletion.consumer.js`)
   - Listens to `workspace-events` topic
   - Processes `WORKSPACE_DELETED` events
   - Performs background cleanup of related data (boards, stages, cards, comments)

3. **Kafka Configuration** (`src/config/kafka.config.js`)
   - Manages Kafka client, producer, and consumer connections
   - Singleton pattern for connection reuse

4. **Kafka Initializer** (`src/services/kafka.init.js`)
   - Initializes Kafka on application startup
   - Handles graceful shutdown

### Event Flow

```
User deletes workspace
        ↓
Workspace Use Case validates permissions
        ↓
Workspace Members deleted immediately
        ↓
Workspace deleted immediately
        ↓
Kafka Producer publishes WORKSPACE_DELETED event
        ↓
API returns immediately (200 OK)
        ↓
Kafka Consumer receives event (background)
        ↓
Consumer cleans up related data:
  1. Comments (on cards)
  2. Cards (in stages)
  3. Stages (in boards)
  4. Boards (in workspace)
```

## 🧪 Testing

### Test Workspace Deletion

1. **Create a workspace with data:**
```bash
# Create workspace
curl -X POST http://localhost:3000/api/v1/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace", "description": "For testing deletion"}'

# Create board, stages, cards, comments...
```

2. **Delete the workspace:**
```bash
curl -X DELETE http://localhost:3000/api/v1/workspaces/WORKSPACE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Monitor the deletion process:**
   - Check application logs for deletion progress
   - Visit Kafka UI at http://localhost:8080 to see the event
   - Verify data is deleted from MongoDB

### Monitor Kafka Events

Visit **Kafka UI** at http://localhost:8080 to:
- View topics
- See messages in `workspace-events` topic
- Monitor consumer groups
- Check consumer lag

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Kafka Configuration
KAFKA_CLIENT_ID=trello-backend
KAFKA_BROKERS=localhost:9092
```

For multiple brokers (production):
```env
KAFKA_BROKERS=broker1:9092,broker2:9092,broker3:9092
```

## 📊 Data Cleanup Order

### Immediate Deletion (Synchronous):
When a workspace is deleted, these are removed immediately:
1. **Workspace Members** - All member associations
2. **Workspace** - The workspace itself

### Background Cleanup (Asynchronous via Kafka):
The consumer then cleans up related data in this order:
3. **Comments** - All comments on cards in the workspace
4. **Cards** - All cards in stages
5. **Stages** - All stages in boards
6. **Boards** - All boards in the workspace

This approach ensures the workspace is removed immediately while heavy cleanup operations happen in the background.

## 🛠️ Troubleshooting

### Kafka Connection Failed

If the application can't connect to Kafka:
1. Check if Kafka is running: `docker ps`
2. Check Kafka logs: `docker logs trello-kafka`
3. Verify `KAFKA_BROKERS` in `.env` is correct

The application will continue to run even if Kafka is unavailable, but workspace deletion will fail.

### Consumer Not Processing Events

1. Check consumer logs in application output
2. Visit Kafka UI and check consumer group status
3. Verify the topic `workspace-events` exists
4. Check for errors in consumer group lag

### Stop Kafka

```bash
docker-compose -f docker-compose.kafka.yml down
```

To remove volumes as well:
```bash
docker-compose -f docker-compose.kafka.yml down -v
```

## 🎯 Benefits of Async Deletion

1. **Fast API Response** - User gets immediate feedback
2. **Resilience** - If deletion fails, it can be retried
3. **Scalability** - Heavy operations don't block the API
4. **Monitoring** - Easy to track deletion progress via Kafka UI
5. **Decoupling** - Deletion logic is separated from API logic

## 📝 Future Enhancements

- Add dead letter queue for failed deletions
- Implement retry mechanism with exponential backoff
- Add deletion status tracking in database
- Send notifications when deletion completes
- Add more event types (board deletion, card updates, etc.)

