const userUseCase = require('../use-cases/user.usecase');

/**
 * User Controller
 * Handles HTTP requests and responses
 * Delegates business logic to use cases
 */

class UserController {
  /**
   * Create a new user
   * POST /api/v1/users
   */
  async createUser(req, res, next) {
    try {
      const { name, email } = req.body;

      if (!name || !email) {
        return res.status(400).json({
          status: 'error',
          message: 'Name and email are required',
        });
      }

      const user = await userUseCase.createUser({ name, email });

      res.status(201).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users
   * GET /api/v1/users
   */
  async getAllUsers(req, res, next) {
    try {
      const users = await userUseCase.getAllUsers();

      res.status(200).json({
        status: 'success',
        results: users.length,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userUseCase.getUserById(id);

      res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user
   * PUT /api/v1/users/:id
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const user = await userUseCase.updateUser(id, updateData);

      res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   * DELETE /api/v1/users/:id
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await userUseCase.deleteUser(id);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();

