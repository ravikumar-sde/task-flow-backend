const authUseCase = require('../use-cases/auth.usecase');

/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */

class AuthController {
  /**
   * Sign up with email and password
   * POST /api/v1/auth/signup
   */
  async signup(req, res, next) {
    try {
      const { name, email, password } = req.body;

      const result = await authUseCase.signup({ name, email, password });

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login with email and password
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authUseCase.login({ email, password });

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * OAuth callback handler
   * Generates JWT tokens after successful OAuth authentication
   */
  async oauthCallback(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication failed',
        });
      }

      // Generate tokens
      const token = authUseCase.generateToken(req.user._id);
      const refreshToken = authUseCase.generateRefreshToken(req.user._id);

      // Save refresh token
      req.user.refreshTokens.push({ token: refreshToken });
      await req.user.save();

      // Redirect to frontend with tokens (or send as JSON)
      // For development, we'll send as JSON
      // In production, you might want to redirect to frontend with tokens in URL
      res.status(200).json({
        status: 'success',
        message: 'OAuth authentication successful',
        data: {
          user: req.user.toJSON(),
          token,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required',
        });
      }

      const result = await authUseCase.refreshAccessToken(refreshToken);

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;

      const result = await authUseCase.logout(req.userId, refreshToken);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const user = await authUseCase.getCurrentUser(req.userId);

      res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const updateData = req.body;

      const user = await authUseCase.updateProfile(req.userId, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();

