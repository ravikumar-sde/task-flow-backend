const express = require('express');
const userController = require('../controllers/user.controller');

const router = express.Router();

/**
 * User Routes
 * Defines all routes for user operations
 */

// Create a new user
router.post('/', userController.createUser.bind(userController));

// Get all users
router.get('/', userController.getAllUsers.bind(userController));

// Get user by ID
router.get('/:id', userController.getUserById.bind(userController));

// Update user
router.put('/:id', userController.updateUser.bind(userController));

// Delete user
router.delete('/:id', userController.deleteUser.bind(userController));

module.exports = router;

