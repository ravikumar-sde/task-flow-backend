const Board = require('../entities/Board');
const BoardModel = require('../database/models/BoardModel');
const WorkspaceModel = require('../database/models/WorkspaceModel');
const WorkspaceMemberModel = require('../database/models/WorkspaceMemberModel');
const StageModel = require('../database/models/StageModel');
const CardModel = require('../database/models/CardModel');

class BoardUseCase {
  async createBoard({ name, description, workspaceId, backgroundColor, userId }) {
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    if (!membership.canCreateBoards()) {
      throw new Error('You do not have permission to create boards in this workspace');
    }

    const board = new Board({
      name,
      description,
      workspaceId,
      createdBy: userId,
      backgroundColor,
    });

    const validation = board.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const boardDoc = await BoardModel.create({
      name: board.name,
      description: board.description,
      workspaceId: board.workspaceId,
      createdBy: board.createdBy,
      backgroundColor: board.backgroundColor || '#0079BF',
    });

    return boardDoc.toSafeObject();
  }

  async getWorkspaceBoards(workspaceId, userId, includeArchived = false) {
    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    const query = { workspaceId };
    if (!includeArchived) {
      query.isArchived = false;
    }

    const boards = await BoardModel.find(query)
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });

    return boards.map(b => ({
      ...b.toSafeObject(),
      createdBy: {
        id: b.createdBy._id,
        name: b.createdBy.name,
        email: b.createdBy.email,
        avatar: b.createdBy.avatar,
      },
    }));
  }

  async getBoardById(boardId, userId) {
    const board = await BoardModel.findById(boardId)
      .populate('createdBy', 'name email avatar');

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You do not have access to this board');
    }

    return {
      ...board.toSafeObject(),
      createdBy: {
        id: board.createdBy._id,
        name: board.createdBy.name,
        email: board.createdBy.email,
        avatar: board.createdBy.avatar,
      },
    };
  }

  async updateBoard(boardId, userId, updateData) {
    const board = await BoardModel.findById(boardId);

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership || !membership.canEditBoards()) {
      throw new Error('You do not have permission to edit this board');
    }

    const allowedUpdates = ['name', 'description', 'backgroundColor'];
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        board[key] = updateData[key];
      }
    });

    await board.save();
    return board.toSafeObject();
  }

  async deleteBoard(boardId, userId) {
    const board = await BoardModel.findById(boardId);

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership || !membership.canDeleteBoards()) {
      throw new Error('You do not have permission to delete this board');
    }

    await BoardModel.findByIdAndDelete(boardId);
    return { message: 'Board deleted successfully' };
  }

  async archiveBoard(boardId, userId) {
    const board = await BoardModel.findById(boardId);

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership || !membership.canEditBoards()) {
      throw new Error('You do not have permission to archive this board');
    }

    await board.archive();
    return board.toSafeObject();
  }

  async unarchiveBoard(boardId, userId) {
    const board = await BoardModel.findById(boardId);

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership || !membership.canEditBoards()) {
      throw new Error('You do not have permission to unarchive this board');
    }

    await board.unarchive();
    return board.toSafeObject();
  }

  async toggleFavorite(boardId, userId) {
    const board = await BoardModel.findById(boardId);

    if (!board) {
      throw new Error('Board not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId: board.workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You do not have access to this board');
    }

    await board.toggleFavorite();
    return board.toSafeObject();
  }

  async getUserFavoriteBoards(userId) {
    const memberships = await WorkspaceMemberModel.find({ userId });
    const workspaceIds = memberships.map(m => m.workspaceId);

    const boards = await BoardModel.find({
      workspaceId: { $in: workspaceIds },
      isFavorite: true,
      isArchived: false,
    })
      .populate('createdBy', 'name email avatar')
      .populate('workspaceId', 'name')
      .sort({ updatedAt: -1 });

    return boards.map(b => ({
      ...b.toSafeObject(),
      workspace: {
        id: b.workspaceId._id,
        name: b.workspaceId.name,
      },
      createdBy: {
        id: b.createdBy._id,
        name: b.createdBy.name,
        email: b.createdBy.email,
        avatar: b.createdBy.avatar,
      },
    }));
  }

  async getBoardDashboard(workspaceId, boardId, userId) {
    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You do not have access to this workspace');
    }

    const board = await BoardModel.findOne({
      _id: boardId,
      workspaceId,
    }).populate('createdBy', 'name email avatar');

    if (!board) {
      throw new Error('Board not found in this workspace');
    }

    const stages = await StageModel.find({ boardId })
      .sort({ position: 1 })
      .lean();

    const stageIds = stages.map(s => s._id);
    const cards = await CardModel.find({ stageId: { $in: stageIds } })
      .populate('createdBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .sort({ position: 1 })
      .lean();

    const stagesWithCards = stages.map(stage => ({
      id: stage._id,
      name: stage.name,
      boardId: stage.boardId,
      position: stage.position,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
      cards: cards
        .filter(card => card.stageId.toString() === stage._id.toString())
        .map(card => ({
          id: card._id,
          title: card.title,
          description: card.description,
          stageId: card.stageId,
          boardId: card.boardId,
          position: card.position,
          priority: card.priority,
          labels: card.labels,
          dueDate: card.dueDate,
          createdBy: card.createdBy ? {
            id: card.createdBy._id,
            name: card.createdBy.name,
            email: card.createdBy.email,
            avatar: card.createdBy.avatar,
          } : null,
          assignedTo: card.assignedTo.map(user => ({
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          })),
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        })),
    }));

    return {
      board: {
        id: board._id,
        name: board.name,
        description: board.description,
        workspaceId: board.workspaceId,
        backgroundColor: board.backgroundColor,
        isFavorite: board.isFavorite,
        isArchived: board.isArchived,
        createdBy: board.createdBy ? {
          id: board.createdBy._id,
          name: board.createdBy.name,
          email: board.createdBy.email,
          avatar: board.createdBy.avatar,
        } : null,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      },
      stages: stagesWithCards,
      memberRole: membership.role,
    };
  }
}

module.exports = new BoardUseCase();

