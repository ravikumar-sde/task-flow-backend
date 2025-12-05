const commentUseCase = require('../use-cases/comment.usecase');

class CommentController {
  async createComment(req, res) {
    try {
      const { content, cardId } = req.body;
      const userId = req.userId;

      const comment = await commentUseCase.createComment({
        content,
        cardId,
        userId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Comment created successfully',
        data: comment,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getCardComments(req, res) {
    try {
      const { cardId } = req.params;
      const userId = req.userId;

      const comments = await commentUseCase.getCardComments(cardId, userId);

      res.status(200).json({
        status: 'success',
        data: comments,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateComment(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.userId;

      const comment = await commentUseCase.updateComment(id, userId, content);

      res.status(200).json({
        status: 'success',
        message: 'Comment updated successfully',
        data: comment,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async deleteComment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await commentUseCase.deleteComment(id, userId);

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
}

module.exports = new CommentController();

