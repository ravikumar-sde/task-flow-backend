class Board {
  constructor({
    id,
    name,
    description,
    workspaceId,
    createdBy,
    backgroundColor,
    isFavorite = false,
    isArchived = false,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.workspaceId = workspaceId;
    this.createdBy = createdBy;
    this.backgroundColor = backgroundColor;
    this.isFavorite = isFavorite;
    this.isArchived = isArchived;
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

  hasValidWorkspace() {
    return this.workspaceId && this.workspaceId.toString().length > 0;
  }

  hasValidCreator() {
    return this.createdBy && this.createdBy.toString().length > 0;
  }

  isValidBackgroundColor() {
    if (!this.backgroundColor) return true;
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(this.backgroundColor);
  }

  validate() {
    const errors = [];

    if (!this.isValidName()) {
      errors.push('Board name must be between 3 and 100 characters');
    }

    if (!this.isValidDescription()) {
      errors.push('Description must not exceed 500 characters');
    }

    if (!this.hasValidWorkspace()) {
      errors.push('Board must belong to a valid workspace');
    }

    if (!this.hasValidCreator()) {
      errors.push('Board must have a valid creator');
    }

    if (!this.isValidBackgroundColor()) {
      errors.push('Background color must be a valid hex color (e.g., #FF5733)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  archive() {
    this.isArchived = true;
  }

  unarchive() {
    this.isArchived = false;
  }

  toggleFavorite() {
    this.isFavorite = !this.isFavorite;
  }
}

module.exports = Board;

