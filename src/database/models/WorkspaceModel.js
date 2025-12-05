const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isPrivate: {
      type: Boolean,
      default: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    inviteCodeExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
workspaceSchema.index({ ownerId: 1, createdAt: -1 });
workspaceSchema.index({ inviteCode: 1, inviteCodeExpiry: 1 });

// Instance method to check if invite code is valid
workspaceSchema.methods.isInviteCodeValid = function () {
  if (!this.inviteCode || !this.inviteCodeExpiry) {
    return false;
  }
  return new Date() < new Date(this.inviteCodeExpiry);
};

// Instance method to generate new invite code
workspaceSchema.methods.generateInviteCode = function (days = 7) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  this.inviteCode = code;
  
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  this.inviteCodeExpiry = expiry;
  
  return code;
};

// Instance method to get safe workspace object (without sensitive data)
workspaceSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    ownerId: this.ownerId,
    isPrivate: this.isPrivate,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Instance method to get workspace with invite link
workspaceSchema.methods.toObjectWithInvite = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    ownerId: this.ownerId,
    isPrivate: this.isPrivate,
    inviteCode: this.inviteCode,
    inviteCodeExpiry: this.inviteCodeExpiry,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const WorkspaceModel = mongoose.model('Workspace', workspaceSchema);

module.exports = WorkspaceModel;

