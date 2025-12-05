const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

const createCommentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment content must be between 1 and 2000 characters'),
  body('cardId')
    .notEmpty()
    .withMessage('Card ID is required')
    .isMongoId()
    .withMessage('Invalid card ID'),
];

const updateCommentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment content must be between 1 and 2000 characters'),
];

router.post('/', authenticate, createCommentValidation, validate, commentController.createComment);
router.get('/card/:cardId', authenticate, commentController.getCardComments);
router.put('/:id', authenticate, updateCommentValidation, validate, commentController.updateComment);
router.delete('/:id', authenticate, commentController.deleteComment);

module.exports = router;

