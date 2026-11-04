const authUseCase = require('../use-cases/auth.usecase');

class AuthController {
  async signup(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = await authUseCase.signup({ name, email, password });
      res.status(201).json({ status: 'success', message: 'User registered successfully', data: result });
    } catch (error) { next(error); }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authUseCase.login({ email, password });
      res.status(200).json({ status: 'success', message: 'Login successful', data: result });
    } catch (error) { next(error); }
  }

  async oauthCallback(req, res, next) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (!req.user) {
        return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('Authentication failed')}`);
      }
      const token = authUseCase.generateToken(req.user._id);
      const refreshToken = authUseCase.generateRefreshToken(req.user._id);
      req.user.refreshTokens.push({ token: refreshToken });
      await req.user.save();
      const redirectUrl = `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth callback failed');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ status: 'error', message: 'Refresh token is required' });
      const result = await authUseCase.refreshAccessToken(refreshToken);
      res.status(200).json({ status: 'success', message: 'Token refreshed successfully', data: result });
    } catch (error) { next(error); }
  }

  async logout(req, res, next) {
    try {
      const result = await authUseCase.logout(req.userId, req.body.refreshToken);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  async getCurrentUser(req, res, next) {
    try {
      const result = await authUseCase.getCurrentUser(req.userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  async updateProfile(req, res, next) {
    try {
      const result = await authUseCase.updateProfile(req.userId, req.body);
      res.status(200).json({ status: 'success', message: 'Profile updated successfully', data: result });
    } catch (error) { next(error); }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authUseCase.forgotPassword({ email: req.body.email, ip: req.ip });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) { next(error); }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authUseCase.changePassword({ userId: req.user.id, currentPassword, newPassword });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (error) { next(error); }
  }
}

module.exports = new AuthController();
