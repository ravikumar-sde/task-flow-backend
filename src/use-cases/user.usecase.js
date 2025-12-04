const User = require('../entities/User');
const UserModel = require('../database/models/UserModel');

/**
 * User Use Cases
 * Contains all business logic operations for User
 * This layer orchestrates the flow of data between entities and database
 */

class UserUseCase {
  /**
   * Create a new user
   */
  async createUser({ name, email }) {
    // Create entity instance
    const user = new User({ name, email });

    // Validate using entity business rules
    const validation = user.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Save to database
    const savedUser = await UserModel.create({ name, email });
    
    return savedUser.toJSON();
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    const users = await UserModel.find({}).sort({ createdAt: -1 });
    return users.map(user => user.toJSON());
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    const user = await UserModel.findById(id);
    
    if (!user) {
      throw new Error('User not found');
    }

    return user.toJSON();
  }

  /**
   * Update user
   */
  async updateUser(id, updateData) {
    const user = await UserModel.findById(id);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Update fields
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;

    // Validate using entity
    const userEntity = new User({
      id: user._id,
      name: user.name,
      email: user.email,
    });

    const validation = userEntity.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Save
    await user.save();
    return user.toJSON();
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    const user = await UserModel.findByIdAndDelete(id);
    
    if (!user) {
      throw new Error('User not found');
    }

    return { message: 'User deleted successfully' };
  }
}

module.exports = new UserUseCase();

