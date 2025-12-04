const express = require('express');
const router = express.Router();
const cardController = require('../controllers/card.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

const createCardValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Card title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('stageId')
    .notEmpty()
    .withMessage('Stage ID is required')
    .isMongoId()
    .withMessage('Invalid stage ID'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('labels')
    .optional()
    .isArray()
    .withMessage('Labels must be an array'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned to must be an array'),
  body('assignedTo.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID in assignedTo'),
];

const updateCardValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Card title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('labels')
    .optional()
    .isArray()
    .withMessage('Labels must be an array'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('Assigned to must be an array'),
  body('assignedTo.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID in assignedTo'),
];

const moveCardValidation = [
  body('targetStageId')
    .notEmpty()
    .withMessage('Target stage ID is required')
    .isMongoId()
    .withMessage('Invalid target stage ID'),
  body('targetPosition')
    .isInt({ min: 0 })
    .withMessage('Target position must be a non-negative integer'),
];

router.post('/', authenticate, createCardValidation, validate, cardController.createCard);
router.get('/stage/:stageId', authenticate, cardController.getStageCards);
router.get('/board/:boardId', authenticate, cardController.getBoardCards);
router.get('/:id', authenticate, cardController.getCardById);
router.put('/:id', authenticate, updateCardValidation, validate, cardController.updateCard);
router.delete('/:id', authenticate, cardController.deleteCard);
router.post('/:id/move', authenticate, moveCardValidation, validate, cardController.moveCard);

module.exports = router;

