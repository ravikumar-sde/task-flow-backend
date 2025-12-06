const jwt = require('jsonwebtoken');
const User = require('../entities/User');
const UserModel = require('../database/models/UserModel');
const config = require('../config/server');
const emailService = require('../services/email.service');

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

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save to database (password will be hashed by pre-save hook)
    const savedUser = await UserModel.create({
      name,
      email,
      password,
      authProvider: 'local',
      isEmailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpiry: verificationExpiry,
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, name, verificationCode);

    return {
      user: savedUser.toJSON(),
      message: 'Signup successful! Please check your email for verification code.',
      emailSent: emailService.isAvailable(),
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

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new Error('Please verify your email before logging in. Check your inbox for the verification code.');
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
        user.isEmailVerified = true; // OAuth emails are verified
        await user.save();
      } else {
        // Create new user
        user = await UserModel.create({
          name,
          email,
          providerId,
          authProvider,
          avatar,
          isEmailVerified: true,
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
   * Verify email with verification code
   */
  async verifyEmail({ email, code }) {
    // Validate input
    if (!email || !code) {
      throw new Error('Email and verification code are required');
    }

    // Find user and include verification fields
    const user = await UserModel.findOne({ email })
      .select('+emailVerificationCode +emailVerificationExpiry');

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    // Check if verification code exists
    if (!user.emailVerificationCode || !user.emailVerificationExpiry) {
      throw new Error('No verification code found. Please request a new one.');
    }

    // Check if code has expired
    if (new Date() > user.emailVerificationExpiry) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    // Verify the code
    if (user.emailVerificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Mark email as verified and clear verification fields
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    // Generate tokens for automatic login after verification
    const token = this.generateToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    return {
      user: user.toJSON(),
      token,
      refreshToken,
      message: 'Email verified successfully! You can now login.',
    };
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode({ email }) {
    // Validate input
    if (!email) {
      throw new Error('Email is required');
    }

    // Find user
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    // Check if user is using local authentication
    if (user.authProvider !== 'local') {
      throw new Error('Email verification is only required for local authentication');
    }

    // Generate new verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with new code
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpiry = verificationExpiry;
    await user.save();

    // Send verification email
    await emailService.sendVerificationEmail(email, user.name, verificationCode);

    return {
      message: 'Verification code sent successfully! Please check your email.',
      emailSent: emailService.isAvailable(),
    };
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
}

module.exports = new AuthUseCase();

