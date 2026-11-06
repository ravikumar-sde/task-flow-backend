const jwt = require('jsonwebtoken');
const User = require('../entities/User');
const UserModel = require('../database/models/UserModel');
const config = require('../config/server');
const { unauthorized, sessionVersion, versionFilter } = require('../utils/session.util');
const { PasswordRecoveryUseCase } = require('./password-recovery.usecase');
const recovery = new PasswordRecoveryUseCase();

class AuthUseCase {
  generateToken(userId, version = 0) {
    return jwt.sign({ id: userId, type: 'access', sessionVersion: sessionVersion(version) }, config.jwtSecret, { expiresIn: config.jwtExpire });
  }

  generateRefreshToken(userId, version = 0) {
    return jwt.sign({ id: userId, type: 'refresh', sessionVersion: sessionVersion(version) }, config.jwtSecret, { expiresIn: '30d' });
  }

  async issueSession(user, credentials = {}) {
    const version = sessionVersion(user.sessionVersion);
    const token = this.generateToken(user._id, version);
    const refreshToken = this.generateRefreshToken(user._id, version);
    const result = await UserModel.updateOne({
      _id: user._id, ...credentials, ...versionFilter(version),
    }, { $push: { refreshTokens: { token: refreshToken } } });
    if (result.matchedCount !== 1) throw unauthorized();
    return { token, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  async signup({ name, email, password }) {
    const user = new User({ name, email, password, authProvider: 'local' });
    const validation = user.validateForSignup();
    if (!validation.isValid) throw new Error(validation.errors.join(', '));
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) throw new Error('User with this email already exists');
    const savedUser = await UserModel.create({ name, email, password, authProvider: 'local' });
    const { token, refreshToken } = await this.issueSession(savedUser);
    return {
      user: savedUser.toJSON(), token, refreshToken,
      message: 'Signup successful! You are now logged in.',
    };
  }

  async login({ email, password }) {
    if (!email || !password) throw new Error('Email and password are required');
    const user = await UserModel.findOne({ email }).select('+password');
    if (!user) throw new Error('Invalid email or password');
    if (user.authProvider !== 'local') {
      throw new Error(`This account uses ${user.authProvider} authentication. Please login with ${user.authProvider}.`);
    }
    if (!await user.comparePassword(password)) throw new Error('Invalid email or password');
    const { token, refreshToken } = await this.issueSession(user, { password: user.password, authProvider: 'local' });
    return { user: user.toJSON(), token, refreshToken };
  }

  async oauthLogin({ email, name, providerId, authProvider, avatar }) {
    let user = await UserModel.findOne({ providerId, authProvider });
    if (!user) {
      user = await UserModel.findOne({ email });
      if (user) {
        user.providerId = providerId;
        user.authProvider = authProvider;
        if (avatar) user.avatar = avatar;
        await user.save();
      } else {
        user = await UserModel.create({ name, email, providerId, authProvider, avatar });
      }
    }
    const { token, refreshToken } = await this.issueSession(user);
    return { user: user.toJSON(), token, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
      const user = await UserModel.findById(decoded.id);
      if (!user) throw new Error('User not found');
      const version = sessionVersion(decoded.sessionVersion);
      if (sessionVersion(user.sessionVersion) !== version) throw unauthorized();
      // Fence against both revocation and logout after the account read. Never
      // adopt a newer account version for credentials from an older session.
      const result = await UserModel.updateOne({
        _id: user._id, ...versionFilter(version), 'refreshTokens.token': refreshToken,
      }, { $set: { sessionVersion: version } });
      if (result.matchedCount !== 1) throw unauthorized();
      return { token: this.generateToken(user._id, version) };
    } catch {
      throw unauthorized('Invalid or expired refresh token');
    }
  }

  async logout(userId, refreshToken) {
    const result = await UserModel.updateOne({ _id: userId }, {
      $pull: { refreshTokens: { token: refreshToken } },
    });
    if (result.matchedCount !== 1) throw new Error('User not found');
    return { message: 'Logged out successfully' };
  }

  async getCurrentUser(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    return user.toJSON();
  }

  async updateProfile(userId, updateData) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    const allowedFields = ['name', 'avatar'];
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) user[key] = updateData[key];
    });
    await user.save();
    return user.toJSON();
  }

  async forgotPassword({ email, ip }) {
    return recovery.request({ email, ip });
  }

  async resetPassword({ token, newPassword }) {
    return recovery.complete({ token, newPassword });
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await UserModel.findById(userId).select('+password');
    if (!user) throw new Error('User not found');
    if (user.authProvider !== 'local') {
      throw new Error(`This account uses ${user.authProvider} authentication. Password change is not available.`);
    }
    if (!await user.comparePassword(currentPassword)) throw new Error('Current password is incorrect');
    if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters long');
    if (currentPassword === newPassword) throw new Error('New password must be different from current password');
    user.password = newPassword;
    await user.save();
    return { message: 'Password has been changed successfully' };
  }
}

module.exports = new AuthUseCase();
