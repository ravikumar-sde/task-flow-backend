const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stage.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

const createStageValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Stage name must be between 1 and 100 characters'),
  body('boardId')
    .notEmpty()
    .withMessage('Board ID is required')
    .isMongoId()
    .withMessage('Invalid board ID'),
];

const updateStageValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Stage name must be between 1 and 100 characters'),
];

const reorderStagesValidation = [
  body('stageOrders')
    .isArray({ min: 1 })
    .withMessage('Stage orders must be a non-empty array'),
  body('stageOrders.*.stageId')
    .isMongoId()
    .withMessage('Invalid stage ID'),
  body('stageOrders.*.position')
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer'),
];

router.post('/', authenticate, createStageValidation, validate, stageController.createStage);
router.get('/board/:boardId', authenticate, stageController.getBoardStages);
router.put('/:id', authenticate, updateStageValidation, validate, stageController.updateStage);
router.delete('/:id', authenticate, stageController.deleteStage);
router.post('/board/:boardId/reorder', authenticate, reorderStagesValidation, validate, stageController.reorderStages);

module.exports = router;

