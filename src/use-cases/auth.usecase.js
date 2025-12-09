const jwt = require('jsonwebtoken');
const User = require('../entities/User');
const UserModel = require('../database/models/UserModel');
const config = require('../config/server');

/**
 * Authentication Use Cases
 * Handles all authentication-related business logic
 */

class AuthUseCase {
  /**
   * Generate JWT token
   */
  generateToken(userId) {
    return jwt.sign({ id: userId }, config.jwtSecret, {
      expiresIn: config.jwtExpire,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign({ id: userId, type: 'refresh' }, config.jwtSecret, {
      expiresIn: '30d',
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Sign up with email and password (local authentication)
   */
  async signup({ name, email, password }) {
    // Create entity instance
    const user = new User({ name, email, password, authProvider: 'local' });

    // Validate using entity business rules
    const validation = user.validateForSignup();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Save to database (password will be hashed by pre-save hook)
    const savedUser = await UserModel.create({
      name,
      email,
      password,
      authProvider: 'local',
    });

    // Generate tokens for automatic login after signup
    const token = this.generateToken(savedUser._id);
    const refreshToken = this.generateRefreshToken(savedUser._id);

    // Save refresh token
    savedUser.refreshTokens.push({ token: refreshToken });
    await savedUser.save();

    return {
      user: savedUser.toJSON(),
      token,
      refreshToken,
      message: 'Signup successful! You are now logged in.',
    };
  }

  /**
   * Login with email and password
   */
  async login({ email, password }) {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user and include password field
    const user = await UserModel.findOne({ email }).select('+password');

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is using local authentication
    if (user.authProvider !== 'local') {
      throw new Error(`This account uses ${user.authProvider} authentication. Please login with ${user.authProvider}.`);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const token = this.generateToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    return {
      user: user.toJSON(),
      token,
      refreshToken,
    };
  }

  /**
   * OAuth authentication (Google, GitHub, etc.)
   */
  async oauthLogin({ email, name, providerId, authProvider, avatar }) {
    // Try to find existing user by provider ID
    let user = await UserModel.findOne({ providerId, authProvider });

    if (!user) {
      // Try to find by email
      user = await UserModel.findOne({ email });

      if (user) {
        // User exists with same email but different provider
        // Link the OAuth account
        user.providerId = providerId;
        user.authProvider = authProvider;
        if (avatar) user.avatar = avatar;
        await user.save();
      } else {
        // Create new user
        user = await UserModel.create({
          name,
          email,
          providerId,
          authProvider,
          avatar,
        });
      }
    }

    // Generate tokens
    const token = this.generateToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    return {
      user: user.toJSON(),
      token,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Find user and verify refresh token exists
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
      if (!tokenExists) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const newToken = this.generateToken(user._id);

      return {
        token: newToken,
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId, refreshToken) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove the refresh token
    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    await user.save();

    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user.toJSON();
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updateData) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Only allow updating certain fields
    const allowedFields = ['name', 'avatar'];
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        user[key] = updateData[key];
      }
    });

    await user.save();
    return user.toJSON();
  }

  /**
   * Forgot password - Reset password without email verification
   * Simple implementation: User provides email and new password
   */
  async forgotPassword({ email, newPassword }) {
    // Find user by email
    const user = await UserModel.findOne({ email }).select('+password');

    if (!user) {
      throw new Error('User not found with this email');
    }

    // Check if user is using OAuth (cannot reset password for OAuth users)
    if (user.authProvider !== 'local') {
      throw new Error(`This account uses ${user.authProvider} authentication. Password reset is not available.`);
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    return {
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  }

  /**
   * Change password - For authenticated users
   * User must provide current password and new password
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    // Find user with password field
    const user = await UserModel.findById(userId).select('+password');

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is using OAuth (cannot change password for OAuth users)
    if (user.authProvider !== 'local') {
      throw new Error(`This account uses ${user.authProvider} authentication. Password change is not available.`);
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    return {
      message: 'Password has been changed successfully',
    };
  }
}

module.exports = new AuthUseCase();

