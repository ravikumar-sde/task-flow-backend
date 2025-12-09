/**
 * User Entity
 * Represents the core business logic for a User
 * This is framework-independent and contains only business rules
 */

class User {
  constructor({
    id,
    name,
    email,
    password,
    authProvider = 'local',
    providerId,
    avatar,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.authProvider = authProvider;
    this.providerId = providerId;
    this.avatar = avatar;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Business logic methods
  isValidEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email);
  }

  isValidName() {
    return this.name && this.name.length >= 2;
  }

  isValidPassword() {
    // Password is required only for local auth
    if (this.authProvider === 'local') {
      return this.password && this.password.length >= 6;
    }
    return true; // OAuth users don't need password
  }

  isOAuthUser() {
    return this.authProvider !== 'local';
  }

  validate() {
    const errors = [];

    if (!this.isValidName()) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!this.isValidEmail()) {
      errors.push('Invalid email format');
    }

    if (!this.isValidPassword()) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateForSignup() {
    // For signup, we need to ensure password is provided for local auth
    const validation = this.validate();

    if (this.authProvider === 'local' && !this.password) {
      validation.errors.push('Password is required for signup');
      validation.isValid = false;
    }

    return validation;
  }
}

module.exports = User;

