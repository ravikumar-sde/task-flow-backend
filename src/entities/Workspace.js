class Workspace {
  constructor({
    id,
    name,
    description,
    ownerId,
    isPrivate = true,
    inviteCode,
    inviteCodeExpiry,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.ownerId = ownerId;
    this.isPrivate = isPrivate;
    this.inviteCode = inviteCode;
    this.inviteCodeExpiry = inviteCodeExpiry;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isValidName() {
    return this.name && this.name.trim().length >= 3 && this.name.length <= 100;
  }

  isValidDescription() {
    if (!this.description) return true;
    return this.description.length <= 500;
  }

  hasValidOwner() {
    return this.ownerId && this.ownerId.toString().length > 0;
  }

  isInviteCodeValid() {
    if (!this.inviteCode || !this.inviteCodeExpiry) {
      return false;
    }
    return new Date() < new Date(this.inviteCodeExpiry);
  }

  validate() {
    const errors = [];

    if (!this.isValidName()) {
      errors.push('Workspace name must be between 3 and 100 characters');
    }

    if (!this.isValidDescription()) {
      errors.push('Description must not exceed 500 characters');
    }

    if (!this.hasValidOwner()) {
      errors.push('Workspace must have a valid owner');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static generateInviteCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  static getInviteCodeExpiry(days = 7) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }
}

module.exports = Workspace;

