const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    backgroundColor: {
      type: String,
      default: '#0079BF',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'Background color must be a valid hex color',
      },
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
boardSchema.index({ workspaceId: 1, isArchived: 1, createdAt: -1 });
boardSchema.index({ createdBy: 1, isFavorite: -1 });
boardSchema.index({ workspaceId: 1, name: 1 });

// Instance method to archive board
boardSchema.methods.archive = function () {
  this.isArchived = true;
  return this.save();
};

// Instance method to unarchive board
boardSchema.methods.unarchive = function () {
  this.isArchived = false;
  return this.save();
};

// Instance method to toggle favorite
boardSchema.methods.toggleFavorite = function () {
  this.isFavorite = !this.isFavorite;
  return this.save();
};

// Instance method to get safe board object
boardSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    workspaceId: this.workspaceId,
    createdBy: this.createdBy,
    backgroundColor: this.backgroundColor,
    isFavorite: this.isFavorite,
    isArchived: this.isArchived,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const BoardModel = mongoose.model('Board', boardSchema);

module.exports = BoardModel;

