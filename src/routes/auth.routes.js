const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  signupValidation,
  loginValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  changePasswordValidation,
  validate,
} = require('../middlewares/validation.middleware');

const router = express.Router();

/**
 * Authentication Routes
 * Handles local and OAuth authentication
 */

// ============================================
// Local Authentication Routes
// ============================================

/**
 * @route   POST /api/v1/auth/signup
 * @desc    Register a new user with email and password
 * @access  Public
 */
router.post(
  '/signup',
  signupValidation,
  validate,
  authController.signup.bind(authController)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post(
  '/login',
  loginValidation,
  validate,
  authController.login.bind(authController)
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken.bind(authController));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout.bind(authController));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  updateProfileValidation,
  validate,
  authController.updateProfile.bind(authController)
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Reset password without email verification (simple implementation)
 * @access  Public
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  validate,
  authController.forgotPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  changePasswordValidation,
  validate,
  authController.changePassword.bind(authController)
);

// ============================================
// Google OAuth Routes
// ============================================

/**
 * @route   GET /api/v1/auth/google
 * @desc    Initiate Google OAuth authentication
 * @access  Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /api/v1/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/v1/auth/failure',
  }),
  authController.oauthCallback.bind(authController)
);

// ============================================
// GitHub OAuth Routes
// ============================================

/**
 * @route   GET /api/v1/auth/github
 * @desc    Initiate GitHub OAuth authentication
 * @access  Public
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
);

/**
 * @route   GET /api/v1/auth/github/callback
 * @desc    GitHub OAuth callback
 * @access  Public
 */
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/api/v1/auth/failure',
  }),
  authController.oauthCallback.bind(authController)
);

// ============================================
// OAuth Failure Route
// ============================================

/**
 * @route   GET /api/v1/auth/failure
 * @desc    OAuth authentication failure
 * @access  Public
 */
router.get('/failure', (req, res) => {
  res.status(401).json({
    status: 'error',
    message: 'OAuth authentication failed',
  });
});

module.exports = router;

