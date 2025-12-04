const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    stageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stage',
      required: true,
      index: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    dueDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    labels: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    createdBy: {
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

cardSchema.index({ stageId: 1, position: 1 });
cardSchema.index({ boardId: 1, createdAt: -1 });
cardSchema.index({ assignedTo: 1 });
cardSchema.index({ dueDate: 1 });

cardSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    stageId: this.stageId,
    boardId: this.boardId,
    position: this.position,
    assignedTo: this.assignedTo,
    dueDate: this.dueDate,
    priority: this.priority,
    labels: this.labels,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const CardModel = mongoose.model('Card', cardSchema);

module.exports = CardModel;

