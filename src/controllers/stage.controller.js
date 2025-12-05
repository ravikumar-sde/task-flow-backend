const stageUseCase = require('../use-cases/stage.usecase');

class StageController {
  async createStage(req, res) {
    try {
      const { name, boardId } = req.body;
      const userId = req.userId;

      const stage = await stageUseCase.createStage({
        name,
        boardId,
        userId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Stage created successfully',
        data: stage,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getBoardStages(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.userId;

      const stages = await stageUseCase.getBoardStages(boardId, userId);

      res.status(200).json({
        status: 'success',
        data: stages,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateStage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const updateData = req.body;

      const stage = await stageUseCase.updateStage(id, userId, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Stage updated successfully',
        data: stage,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async deleteStage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await stageUseCase.deleteStage(id, userId);

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

  async reorderStages(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.userId;
      const { stageOrders } = req.body;

      const stages = await stageUseCase.reorderStages(boardId, userId, stageOrders);

      res.status(200).json({
        status: 'success',
        message: 'Stages reordered successfully',
        data: stages,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

module.exports = new StageController();

