const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ cardId: 1, createdAt: -1 });

commentSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    content: this.content,
    cardId: this.cardId,
    userId: this.userId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const CommentModel = mongoose.model('Comment', commentSchema);

module.exports = CommentModel;

