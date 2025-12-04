const express = require('express');
const router = express.Router();
const boardController = require('../controllers/board.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

const createBoardValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Board name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('workspaceId')
    .notEmpty()
    .withMessage('Workspace ID is required')
    .isMongoId()
    .withMessage('Invalid workspace ID'),
  body('backgroundColor')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Background color must be a valid hex color (e.g., #FF5733)'),
];

const updateBoardValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Board name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('backgroundColor')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Background color must be a valid hex color (e.g., #FF5733)'),
];

router.get('/favorites', authenticate, boardController.getFavoriteBoards);
router.post('/', authenticate, createBoardValidation, validate, boardController.createBoard);
router.get('/:id', authenticate, boardController.getBoardById);
router.put('/:id', authenticate, updateBoardValidation, validate, boardController.updateBoard);
router.delete('/:id', authenticate, boardController.deleteBoard);
router.post('/:id/archive', authenticate, boardController.archiveBoard);
router.post('/:id/unarchive', authenticate, boardController.unarchiveBoard);
router.post('/:id/favorite', authenticate, boardController.toggleFavorite);
router.get('/workspace/:workspaceId', authenticate, boardController.getWorkspaceBoards);

module.exports = router;

