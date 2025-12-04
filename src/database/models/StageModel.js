const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
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
  },
  {
    timestamps: true,
  }
);

stageSchema.index({ boardId: 1, position: 1 });

stageSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    boardId: this.boardId,
    position: this.position,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const StageModel = mongoose.model('Stage', stageSchema);

module.exports = StageModel;

