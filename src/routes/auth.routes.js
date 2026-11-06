const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  signupValidation, loginValidation, updateProfileValidation,
  forgotPasswordValidation, changePasswordValidation, validate,
} = require('../middlewares/validation.middleware');

const router = express.Router();
router.post('/signup', signupValidation, validate, authController.signup.bind(authController));
router.post('/login', loginValidation, validate, authController.login.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));
router.put('/profile', authenticate, updateProfileValidation, validate, authController.updateProfile.bind(authController));

// Public email-only recovery request. Passwords are never changed here.
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword.bind(authController));

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', {
  session: false, failureRedirect: '/api/v1/auth/failure',
}), authController.oauthCallback.bind(authController));
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/github/callback', passport.authenticate('github', {
  session: false, failureRedirect: '/api/v1/auth/failure',
}), authController.oauthCallback.bind(authController));
router.get('/failure', (req, res) => {
  res.status(401).json({ status: 'error', message: 'OAuth authentication failed' });
});

module.exports = router;
