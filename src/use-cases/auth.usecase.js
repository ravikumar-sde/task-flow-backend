const jwt = require('jsonwebtoken');
const User = require('../entities/User');
const UserModel = require('../database/models/UserModel');
const config = require('../config/server');
const { PasswordRecoveryUseCase } = require('./password-recovery.usecase');
const recovery = new PasswordRecoveryUseCase();

class AuthUseCase {
  generateToken(userId) {
    return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: config.jwtExpire });
  }

  generateRefreshToken(userId) {
    return jwt.sign({ id: userId, type: 'refresh' }, config.jwtSecret, { expiresIn: '30d' });
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
    const token = this.generateToken(savedUser._id);
    const refreshToken = this.generateRefreshToken(savedUser._id);
    savedUser.refreshTokens.push({ token: refreshToken });
    await savedUser.save();
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
    const token = this.generateToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();
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
    const token = this.generateToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();
    return { user: user.toJSON(), token, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
      const user = await UserModel.findById(decoded.id);
      if (!user) throw new Error('User not found');
      if (!user.refreshTokens.some(rt => rt.token === refreshToken)) throw new Error('Invalid refresh token');
      return { token: this.generateToken(user._id) };
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async logout(userId, refreshToken) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    await user.save();
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
