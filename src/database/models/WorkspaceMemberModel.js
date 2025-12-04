const mongoose = require('mongoose');

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can only be a member of a workspace once
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

// Index for querying all workspaces of a user
workspaceMemberSchema.index({ userId: 1, createdAt: -1 });

// Index for querying all members of a workspace
workspaceMemberSchema.index({ workspaceId: 1, role: 1 });

// Instance method to check permissions
workspaceMemberSchema.methods.isAdmin = function () {
  return this.role === 'admin';
};

workspaceMemberSchema.methods.isMember = function () {
  return this.role === 'member';
};

workspaceMemberSchema.methods.isViewer = function () {
  return this.role === 'viewer';
};

workspaceMemberSchema.methods.canManageMembers = function () {
  return this.isAdmin();
};

workspaceMemberSchema.methods.canCreateBoards = function () {
  return this.isAdmin() || this.isMember();
};

workspaceMemberSchema.methods.canEditBoards = function () {
  return this.isAdmin() || this.isMember();
};

workspaceMemberSchema.methods.canDeleteBoards = function () {
  return this.isAdmin();
};

// Instance method to get safe member object
workspaceMemberSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    workspaceId: this.workspaceId,
    userId: this.userId,
    role: this.role,
    joinedAt: this.joinedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const WorkspaceMemberModel = mongoose.model('WorkspaceMember', workspaceMemberSchema);

module.exports = WorkspaceMemberModel;

