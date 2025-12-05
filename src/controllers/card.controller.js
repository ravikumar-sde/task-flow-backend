const cardUseCase = require('../use-cases/card.usecase');

class CardController {
  async createCard(req, res) {
    try {
      const { title, description, stageId, priority, labels, dueDate, assignedTo } = req.body;
      const userId = req.userId;

      const card = await cardUseCase.createCard({
        title,
        description,
        stageId,
        priority,
        labels,
        dueDate,
        assignedTo,
        userId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Card created successfully',
        data: card,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getStageCards(req, res) {
    try {
      const { stageId } = req.params;
      const userId = req.userId;

      const cards = await cardUseCase.getStageCards(stageId, userId);

      res.status(200).json({
        status: 'success',
        data: cards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getBoardCards(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.userId;

      const cards = await cardUseCase.getBoardCards(boardId, userId);

      res.status(200).json({
        status: 'success',
        data: cards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getCardById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const card = await cardUseCase.getCardById(id, userId);

      res.status(200).json({
        status: 'success',
        data: card,
      });
    } catch (error) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateCard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const updateData = req.body;

      const card = await cardUseCase.updateCard(id, userId, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Card updated successfully',
        data: card,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async deleteCard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await cardUseCase.deleteCard(id, userId);

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

  async moveCard(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { targetStageId, targetPosition } = req.body;

      const card = await cardUseCase.moveCard(id, userId, {
        targetStageId,
        targetPosition,
      });

      res.status(200).json({
        status: 'success',
        message: 'Card moved successfully',
        data: card,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async filterCards(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.userId;
      const { members, labels, dueDate } = req.query;

      const filters = {};
      if (members) {
        filters.members = Array.isArray(members) ? members : [members];
      }
      if (labels) {
        filters.labels = Array.isArray(labels) ? labels : [labels];
      }
      if (dueDate) {
        filters.dueDate = dueDate;
      }

      const cards = await cardUseCase.filterCards(boardId, userId, filters);

      res.status(200).json({
        status: 'success',
        data: cards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async searchCards(req, res) {
    try {
      const { boardId } = req.params;
      const userId = req.userId;
      const { q } = req.query;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Search query is required',
        });
      }

      const cards = await cardUseCase.searchCards(boardId, userId, q.trim());

      res.status(200).json({
        status: 'success',
        data: cards,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

module.exports = new CardController();

