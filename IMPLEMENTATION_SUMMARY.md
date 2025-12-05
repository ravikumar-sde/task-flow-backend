# Kafka Integration - Implementation Summary

## ✅ What Was Implemented

### 1. **Kafka Infrastructure**

#### Files Created:
- `src/config/kafka.config.js` - Kafka client configuration with producer and consumer management
- `src/services/kafka.producer.js` - Producer service for publishing events
- `src/services/kafka.consumers/workspace-deletion.consumer.js` - Consumer for workspace deletion events
- `src/services/kafka.init.js` - Kafka initialization and shutdown orchestration
- `docker-compose.kafka.yml` - Docker Compose file for local Kafka setup
- `KAFKA_SETUP.md` - Complete Kafka setup and usage documentation

#### Files Modified:
- `src/use-cases/workspace.usecase.js` - Updated to publish Kafka events instead of direct deletion
- `src/server.js` - Added Kafka initialization on startup and graceful shutdown
- `.env` - Added Kafka configuration variables
- `package.json` - Added kafkajs dependency

---

## 🏗️ Architecture Overview

### Event-Driven Workspace Deletion Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Deletes Workspace                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Workspace Use Case                                              │
│  1. Validates user is workspace owner                            │
│  2. Deletes workspace members                                    │
│  3. Deletes workspace immediately                                │
│  4. Publishes WORKSPACE_DELETED event to Kafka                   │
│  5. Returns immediately (200 OK)                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Kafka Topic: workspace-events                                   │
│  Event: { type: 'WORKSPACE_DELETED', workspaceId, userId }       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Workspace Deletion Consumer (Background Cleanup)                │
│  Processes event asynchronously:                                 │
│  1. Find all boards in workspace                                 │
│  2. Find all stages in those boards                              │
│  3. Find all cards in those stages                               │
│  4. Delete all comments on those cards                           │
│  5. Delete all cards                                             │
│  6. Delete all stages                                            │
│  7. Delete all boards                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Dependencies Installed

```json
{
  "kafkajs": "^2.2.4"
}
```

---

## 🔧 Configuration

### Environment Variables (.env)

```env
# Kafka Configuration
KAFKA_CLIENT_ID=trello-backend
KAFKA_BROKERS=localhost:9092
```

For production with multiple brokers:
```env
KAFKA_BROKERS=broker1:9092,broker2:9092,broker3:9092
```

---

## 🚀 How to Use

### Option 1: With Kafka (Full Async Deletion)

1. **Start Kafka:**
```bash
docker compose -f docker-compose.kafka.yml up -d
```

2. **Start the application:**
```bash
npm run dev
```

3. **Delete a workspace:**
```bash
curl -X DELETE http://localhost:3000/api/v1/workspaces/{workspaceId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "message": "Workspace deleted successfully. Related data cleanup is in progress.",
  "workspaceId": "...",
  "status": "deleted"
}
```

4. **Monitor deletion:**
   - Check application logs for deletion progress
   - Visit Kafka UI at http://localhost:8080
   - Verify data is deleted from MongoDB

### Option 2: Without Kafka (Graceful Degradation)

If Kafka is not available, the application will:
- Start successfully with a warning
- Workspace deletion will fail (event cannot be published)
- All other features work normally

---

## 📊 Data Deletion Order

### Immediate Deletion (Synchronous):
1. **Workspace Members** - Deleted immediately when workspace is deleted
2. **Workspace** - Deleted immediately (root entity)

### Background Cleanup (Asynchronous via Kafka):
3. **Comments** - All comments on cards in the workspace
4. **Cards** - All cards in stages
5. **Stages** - All stages in boards
6. **Boards** - All boards in the workspace

This approach ensures the workspace is removed immediately while heavy cleanup operations happen in the background without blocking the API response.

---

## 🎯 Benefits

### 1. **Fast API Response**
- User gets immediate feedback (202 Accepted)
- No waiting for cascading deletions

### 2. **Resilience**
- If deletion fails, Kafka can retry
- Events are persisted in Kafka until processed

### 3. **Scalability**
- Heavy deletion operations don't block the API
- Can scale consumers independently

### 4. **Monitoring**
- Easy to track deletion progress via Kafka UI
- Detailed logs for each deletion step

### 5. **Decoupling**
- Deletion logic separated from API logic
- Easier to maintain and test

---

## 🧪 Testing

### Test Scenario: Complete Workspace Deletion

1. Create test data:
```bash
# Create workspace
WORKSPACE_ID=$(curl -X POST http://localhost:3000/api/v1/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace"}' | jq -r '.data.id')

# Create board
BOARD_ID=$(curl -X POST http://localhost:3000/api/v1/boards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Board\", \"workspaceId\": \"$WORKSPACE_ID\"}" | jq -r '.data.id')

# Create stage, cards, comments...
```

2. Delete workspace:
```bash
curl -X DELETE http://localhost:3000/api/v1/workspaces/$WORKSPACE_ID \
  -H "Authorization: Bearer $TOKEN"
```

3. Verify deletion in logs:
```
🗑️  Processing workspace deletion: 6932766c5b6a44ca9baa5f1b
   Found 2 boards to delete
   Found 4 stages to delete
   Found 8 cards to delete
   ✅ Deleted 12 comments
   ✅ Deleted 8 cards
   ✅ Deleted 4 stages
   ✅ Deleted 2 boards
   ✅ Deleted 3 workspace members
✅ Workspace 6932766c5b6a44ca9baa5f1b and all related data deleted successfully!
```

---

## 🛠️ Troubleshooting

### Kafka Not Starting

If Docker Compose fails to start Kafka:
- Check Docker is running: `docker ps`
- Check network connectivity
- Try pulling images manually: `docker pull confluentinc/cp-kafka:7.5.0`

### Application Won't Start

If the application fails to start:
- Check if Kafka is required or optional in your setup
- The app should start even without Kafka (with warnings)
- Check logs for specific errors

### Deletion Not Working

If workspace deletion doesn't work:
1. Check Kafka is running: `docker ps | grep kafka`
2. Check consumer is running: Look for "Workspace Deletion Consumer is running" in logs
3. Check Kafka UI for events: http://localhost:8080
4. Check for errors in application logs

---

## 📝 Future Enhancements

- [ ] Add dead letter queue for failed deletions
- [ ] Implement retry mechanism with exponential backoff
- [ ] Add deletion status tracking in database
- [ ] Send email notifications when deletion completes
- [ ] Add more event types (board deletion, card updates, etc.)
- [ ] Implement event sourcing for audit trail
- [ ] Add Kafka metrics and monitoring
- [ ] Implement idempotent event processing

---

## 🔐 Security Considerations

- Only workspace owners can delete workspaces (validated before publishing event)
- Events include userId for audit trail
- Consumer validates workspace exists before deletion
- All deletions are logged with timestamps

---

## 📚 Additional Resources

- [KafkaJS Documentation](https://kafka.js.org/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Kafka UI Documentation](https://docs.kafka-ui.provectus.io/)
- See `KAFKA_SETUP.md` for detailed setup instructions

