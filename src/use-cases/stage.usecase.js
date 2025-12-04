const Stage = require('../entities/Stage');
const StageModel = require('../database/models/StageModel');
const BoardModel = require('../database/models/BoardModel');
const WorkspaceMemberModel = require('../database/models/WorkspaceMemberModel');
const CardModel = require('../database/models/CardModel');

class StageUseCase {
  async createStage({ name, boardId, userId }) {
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

    if (!membership.canCreateBoards()) {
      throw new Error('You do not have permission to create stages in this board');
    }

    const maxPositionStage = await StageModel.findOne({ boardId })
      .sort({ position: -1 })
      .limit(1);

    const position = maxPositionStage ? maxPositionStage.position + 1 : 0;

    const stage = new Stage({
      name,
      boardId,
      position,
    });

    const validation = stage.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const stageModel = new StageModel({
      name: stage.name,
      boardId: stage.boardId,
      position: stage.position,
    });

    await stageModel.save();
    return stageModel.toSafeObject();
  }

  async getBoardStages(boardId, userId) {
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

    const stages = await StageModel.find({ boardId }).sort({ position: 1 });
    return stages.map(stage => stage.toSafeObject());
  }

  async updateStage(stageId, userId, updateData) {
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

    if (!membership.canEditBoards()) {
      throw new Error('You do not have permission to edit stages in this board');
    }

    if (updateData.name !== undefined) {
      stage.name = updateData.name;
    }

    await stage.save();
    return stage.toSafeObject();
  }

  async deleteStage(stageId, userId) {
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

    if (!membership.canDeleteBoards()) {
      throw new Error('You do not have permission to delete stages in this board');
    }

    await CardModel.deleteMany({ stageId });
    await StageModel.findByIdAndDelete(stageId);

    await this.reorderStagesAfterDelete(stage.boardId, stage.position);

    return { message: 'Stage and associated tasks deleted successfully' };
  }

  async reorderStages(boardId, userId, stageOrders) {
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

    if (!membership.canEditBoards()) {
      throw new Error('You do not have permission to reorder stages in this board');
    }

    const updatePromises = stageOrders.map(({ stageId, position }) => {
      return StageModel.findByIdAndUpdate(
        stageId,
        { position },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    const stages = await StageModel.find({ boardId }).sort({ position: 1 });
    return stages.map(stage => stage.toSafeObject());
  }

  async reorderStagesAfterDelete(boardId, deletedPosition) {
    const stages = await StageModel.find({
      boardId,
      position: { $gt: deletedPosition }
    });

    const updatePromises = stages.map(stage => {
      stage.position -= 1;
      return stage.save();
    });

    await Promise.all(updatePromises);
  }
}

module.exports = new StageUseCase();

