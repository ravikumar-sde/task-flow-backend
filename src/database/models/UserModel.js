const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      select: false,
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github', 'facebook'],
      default: 'local',
    },
    providerId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
    },
    refreshTokens: [{
      token: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

userSchema.index({ providerId: 1, authProvider: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  if (!this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    authProvider: user.authProvider,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    avatar: this.avatar,
  };
};

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;

