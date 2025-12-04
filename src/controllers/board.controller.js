const boardUseCase = require('../use-cases/board.usecase');

class BoardController {
  async createBoard(req, res) {
    try {
      const { name, description, workspaceId, backgroundColor } = req.body;
      const userId = req.userId;

      const board = await boardUseCase.createBoard({
        name,
        description,
        workspaceId,
        backgroundColor,
        userId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Board created successfully',
        data: board,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getWorkspaceBoards(req, res) {
    try {
      const { workspaceId } = req.params;
      const userId = req.userId;
      const includeArchived = req.query.includeArchived === 'true';

      const boards = await boardUseCase.getWorkspaceBoards(
        workspaceId,
        userId,
        includeArchived
      );

      res.status(200).json({
        status: 'success',
        data: boards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getBoardById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const board = await boardUseCase.getBoardById(id, userId);

      res.status(200).json({
        status: 'success',
        data: board,
      });
    } catch (error) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const updateData = req.body;

      const board = await boardUseCase.updateBoard(id, userId, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Board updated successfully',
        data: board,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async deleteBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await boardUseCase.deleteBoard(id, userId);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async archiveBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const board = await boardUseCase.archiveBoard(id, userId);

      res.status(200).json({
        status: 'success',
        message: 'Board archived successfully',
        data: board,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async unarchiveBoard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const board = await boardUseCase.unarchiveBoard(id, userId);

      res.status(200).json({
        status: 'success',
        message: 'Board unarchived successfully',
        data: board,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async toggleFavorite(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const board = await boardUseCase.toggleFavorite(id, userId);

      res.status(200).json({
        status: 'success',
        message: 'Board favorite status updated',
        data: board,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getFavoriteBoards(req, res) {
    try {
      const userId = req.userId;

      const boards = await boardUseCase.getUserFavoriteBoards(userId);

      res.status(200).json({
        status: 'success',
        data: boards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

module.exports = new BoardController();

