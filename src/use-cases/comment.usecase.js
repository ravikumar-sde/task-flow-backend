const Comment = require('../entities/Comment');
const CommentModel = require('../database/models/CommentModel');
const CardModel = require('../database/models/CardModel');
const BoardModel = require('../database/models/BoardModel');
const WorkspaceMemberModel = require('../database/models/WorkspaceMemberModel');

class CommentUseCase {
  async createComment({ content, cardId, userId }) {
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

    const comment = new Comment({
      content,
      cardId,
      userId,
    });

    const validation = comment.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const commentDoc = await CommentModel.create({
      content: comment.content,
      cardId: comment.cardId,
      userId: comment.userId,
    });

    const populatedComment = await CommentModel.findById(commentDoc._id)
      .populate('userId', 'name email avatar');

    return {
      id: populatedComment._id,
      content: populatedComment.content,
      cardId: populatedComment.cardId,
      user: {
        id: populatedComment.userId._id,
        name: populatedComment.userId.name,
        email: populatedComment.userId.email,
        avatar: populatedComment.userId.avatar,
      },
      createdAt: populatedComment.createdAt,
      updatedAt: populatedComment.updatedAt,
    };
  }

  async getCardComments(cardId, userId) {
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

    const comments = await CommentModel.find({ cardId })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 });

    return comments.map(comment => ({
      id: comment._id,
      content: comment.content,
      cardId: comment.cardId,
      user: {
        id: comment.userId._id,
        name: comment.userId.name,
        email: comment.userId.email,
        avatar: comment.userId.avatar,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));
  }

  async updateComment(commentId, userId, content) {
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new Error('You can only edit your own comments');
    }

    const updatedCommentEntity = new Comment({
      id: comment._id,
      content,
      cardId: comment.cardId,
      userId: comment.userId,
    });

    const validation = updatedCommentEntity.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    comment.content = content;
    await comment.save();

    const populatedComment = await CommentModel.findById(comment._id)
      .populate('userId', 'name email avatar');

    return {
      id: populatedComment._id,
      content: populatedComment.content,
      cardId: populatedComment.cardId,
      user: {
        id: populatedComment.userId._id,
        name: populatedComment.userId.name,
        email: populatedComment.userId.email,
        avatar: populatedComment.userId.avatar,
      },
      createdAt: populatedComment.createdAt,
      updatedAt: populatedComment.updatedAt,
    };
  }

  async deleteComment(commentId, userId) {
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new Error('You can only delete your own comments');
    }

    await CommentModel.findByIdAndDelete(commentId);

    return { message: 'Comment deleted successfully' };
  }
}

module.exports = new CommentUseCase();

