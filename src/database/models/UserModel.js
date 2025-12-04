const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Database representation of User entity with authentication support
 */

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
      select: false, // Don't include password in queries by default
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github', 'facebook'],
      default: 'local',
    },
    providerId: {
      type: String,
      sparse: true, // Allow multiple null values but unique non-null values
    },
    avatar: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
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
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ providerId: 1, authProvider: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  // Don't hash if password is not set (OAuth users)
  if (!this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate safe user object (without sensitive data)
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    authProvider: user.authProvider,
    avatar: user.avatar,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    avatar: this.avatar,
  };
};

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;

