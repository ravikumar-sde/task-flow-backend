const Card = require('../entities/Card');
const CardModel = require('../database/models/CardModel');
const StageModel = require('../database/models/StageModel');
const BoardModel = require('../database/models/BoardModel');
const WorkspaceMemberModel = require('../database/models/WorkspaceMemberModel');

class CardUseCase {
  async createCard({ title, description, stageId, priority, labels, dueDate, assignedTo, userId }) {
    const stage = await StageModel.findById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    const board = await BoardModel.findById(stage.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    if (!membership.canCreateBoards()) {
      throw new Error('You do not have permission to create cards in this board');
    }

    const maxPositionCard = await CardModel.findOne({ stageId })
      .sort({ position: -1 })
      .limit(1);

    const position = maxPositionCard ? maxPositionCard.position + 1 : 0;

    const card = new Card({
      title,
      description,
      stageId,
      boardId: stage.boardId,
      position,
      priority: priority || 'medium',
      labels: labels || [],
      dueDate,
      assignedTo: assignedTo || [],
      createdBy: userId,
    });

    const validation = card.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const cardModel = new CardModel({
      title: card.title,
      description: card.description,
      stageId: card.stageId,
      boardId: card.boardId,
      position: card.position,
      priority: card.priority,
      labels: card.labels,
      dueDate: card.dueDate,
      assignedTo: card.assignedTo,
      createdBy: card.createdBy,
    });

    await cardModel.save();
    return cardModel.toSafeObject();
  }

  async getStageCards(stageId, userId) {
    const stage = await StageModel.findById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    const board = await BoardModel.findById(stage.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    const cards = await CardModel.find({ stageId })
      .sort({ position: 1 })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    return cards.map(card => card.toSafeObject());
  }

  async getBoardCards(boardId, userId) {
    const board = await BoardModel.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    const cards = await CardModel.find({ boardId })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('stageId', 'name');

    return cards.map(card => card.toSafeObject());
  }

  async getCardById(cardId, userId) {
    const card = await CardModel.findById(cardId)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('stageId', 'name')
      .populate('boardId', 'name');

    if (!card) {
      throw new Error('Card not found');
    }

    const board = await BoardModel.findById(card.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    return card.toSafeObject();
  }

  async updateCard(cardId, userId, updateData) {
    const card = await CardModel.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const board = await BoardModel.findById(card.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    if (!membership.canEditBoards()) {
      throw new Error('You do not have permission to edit cards in this board');
    }

    const allowedUpdates = ['title', 'description', 'priority', 'labels', 'dueDate', 'assignedTo'];
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        card[key] = updateData[key];
      }
    });

    await card.save();
    return card.toSafeObject();
  }

  async deleteCard(cardId, userId) {
    const card = await CardModel.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const board = await BoardModel.findById(card.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    if (!membership.canDeleteBoards()) {
      throw new Error('You do not have permission to delete cards in this board');
    }

    await CardModel.findByIdAndDelete(cardId);
    await this.reorderCardsAfterDelete(card.stageId, card.position);

    return { message: 'Card deleted successfully' };
  }

  async moveCard(cardId, userId, { targetStageId, targetPosition }) {
    const card = await CardModel.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const board = await BoardModel.findById(card.boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    if (!membership.canEditBoards()) {
      throw new Error('You do not have permission to move cards in this board');
    }

    const targetStage = await StageModel.findById(targetStageId);
    if (!targetStage) {
      throw new Error('Target stage not found');
    }

    if (targetStage.boardId.toString() !== card.boardId.toString()) {
      throw new Error('Cannot move card to a stage in a different board');
    }

    const oldStageId = card.stageId;
    const oldPosition = card.position;

    if (oldStageId.toString() === targetStageId.toString()) {
      await this.reorderCardsInSameStage(oldStageId, oldPosition, targetPosition);
      card.position = targetPosition;
    } else {
      await this.reorderCardsAfterDelete(oldStageId, oldPosition);
      await this.makeSpaceForCard(targetStageId, targetPosition);
      card.stageId = targetStageId;
      card.position = targetPosition;
    }

    await card.save();
    return card.toSafeObject();
  }

  async reorderCardsAfterDelete(stageId, deletedPosition) {
    const cards = await CardModel.find({
      stageId,
      position: { $gt: deletedPosition }
    });

    const updatePromises = cards.map(card => {
      card.position -= 1;
      return card.save();
    });

    await Promise.all(updatePromises);
  }

  async makeSpaceForCard(stageId, targetPosition) {
    const cards = await CardModel.find({
      stageId,
      position: { $gte: targetPosition }
    });

    const updatePromises = cards.map(card => {
      card.position += 1;
      return card.save();
    });

    await Promise.all(updatePromises);
  }

  async reorderCardsInSameStage(stageId, oldPosition, newPosition) {
    if (oldPosition === newPosition) return;

    if (oldPosition < newPosition) {
      const cards = await CardModel.find({
        stageId,
        position: { $gt: oldPosition, $lte: newPosition }
      });

      const updatePromises = cards.map(card => {
        card.position -= 1;
        return card.save();
      });

      await Promise.all(updatePromises);
    } else {
      const cards = await CardModel.find({
        stageId,
        position: { $gte: newPosition, $lt: oldPosition }
      });

      const updatePromises = cards.map(card => {
        card.position += 1;
        return card.save();
      });

      await Promise.all(updatePromises);
    }
  }
}

module.exports = new CardUseCase();

