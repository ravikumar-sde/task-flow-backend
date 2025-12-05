const kafkaConfig = require('../../config/kafka.config');
const BoardModel = require('../../database/models/BoardModel');
const StageModel = require('../../database/models/StageModel');
const CardModel = require('../../database/models/CardModel');
const CommentModel = require('../../database/models/CommentModel');

class WorkspaceDeletionConsumer {
  constructor() {
    this.consumer = null;
    this.isRunning = false;
  }

  async start() {
    try {
      this.consumer = await kafkaConfig.createConsumer(
        'workspace-deletion-group',
        ['workspace-events']
      );

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event = JSON.parse(message.value.toString());
            
            if (event.type === 'WORKSPACE_DELETED') {
              await this.handleWorkspaceDeletion(event.data);
            }
          } catch (error) {
            console.error('Error processing workspace deletion event:', error);
            // Don't throw - let the consumer continue processing other messages
          }
        },
      });

      this.isRunning = true;
      console.log('🎧 Workspace Deletion Consumer is running...');
    } catch (error) {
      console.error('Failed to start Workspace Deletion Consumer:', error);
      throw error;
    }
  }

  async handleWorkspaceDeletion(data) {
    const { workspaceId, userId, timestamp } = data;
    
    console.log(`🧹 Processing background cleanup for workspace: ${workspaceId} (initiated by ${userId} at ${timestamp})`);

    try {
      // Step 1: Find all boards in the workspace
      const boards = await BoardModel.find({ workspaceId }).lean();
      const boardIds = boards.map(b => b._id);

      console.log(`   Found ${boards.length} boards to clean up`);

      if (boardIds.length > 0) {
        // Step 2: Find all stages in these boards
        const stages = await StageModel.find({ boardId: { $in: boardIds } }).lean();
        const stageIds = stages.map(s => s._id);
        
        console.log(`   Found ${stages.length} stages to clean up`);

        if (stageIds.length > 0) {
          // Step 3: Find all cards in these stages
          const cards = await CardModel.find({ stageId: { $in: stageIds } }).lean();
          const cardIds = cards.map(c => c._id);
          
          console.log(`   Found ${cards.length} cards to clean up`);

          if (cardIds.length > 0) {
            // Step 4: Delete all comments on these cards
            const commentsDeleted = await CommentModel.deleteMany({ 
              cardId: { $in: cardIds } 
            });
            console.log(`   ✅ Deleted ${commentsDeleted.deletedCount} comments`);
          }

          // Step 5: Delete all cards
          const cardsDeleted = await CardModel.deleteMany({ 
            stageId: { $in: stageIds } 
          });
          console.log(`   ✅ Deleted ${cardsDeleted.deletedCount} cards`);
        }

        // Step 6: Delete all stages
        const stagesDeleted = await StageModel.deleteMany({ 
          boardId: { $in: boardIds } 
        });
        console.log(`   ✅ Deleted ${stagesDeleted.deletedCount} stages`);

        // Step 7: Delete all boards
        const boardsDeleted = await BoardModel.deleteMany({ 
          workspaceId 
        });
        console.log(`   ✅ Deleted ${boardsDeleted.deletedCount} boards`);
      }

      console.log(`✅ Background cleanup completed for workspace ${workspaceId}!`);

    } catch (error) {
      console.error(`❌ Error during background cleanup for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  async stop() {
    if (this.consumer) {
      await this.consumer.stop();
      await this.consumer.disconnect();
      this.isRunning = false;
      console.log('Workspace Deletion Consumer stopped');
    }
  }
}

// Singleton instance
const workspaceDeletionConsumer = new WorkspaceDeletionConsumer();

module.exports = workspaceDeletionConsumer;

