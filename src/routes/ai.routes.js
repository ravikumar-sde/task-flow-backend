const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

/**
 * Validation for parse prompt endpoint
 */
const parsePromptValidation = [
  body('prompt')
    .trim()
    .notEmpty()
    .withMessage('Prompt is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Prompt must be between 10 and 1000 characters'),
];

/**
 * @route   POST /api/v1/ai/parse-prompt
 * @desc    Parse user prompt and generate structured JSON
 * @access  Private (requires authentication)
 */
router.post(
  '/parse-prompt',
  authenticate,
  parsePromptValidation,
  validate,
  aiController.parsePrompt
);

/**
 * @route   GET /api/v1/ai/health
 * @desc    Check AI service health and configuration
 * @access  Private (requires authentication)
 */
router.get(
  '/health',
  authenticate,
  aiController.healthCheck
);

module.exports = router;

