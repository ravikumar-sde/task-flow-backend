class Stage {
  constructor({
    id,
    name,
    boardId,
    position,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.name = name;
    this.boardId = boardId;
    this.position = position;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isValidName() {
    return this.name && this.name.trim().length >= 1 && this.name.length <= 100;
  }

  hasValidBoard() {
    return this.boardId && this.boardId.toString().length > 0;
  }

  isValidPosition() {
    return typeof this.position === 'number' && this.position >= 0;
  }

  validate() {
    const errors = [];

    if (!this.isValidName()) {
      errors.push('Stage name must be between 1 and 100 characters');
    }

    if (!this.hasValidBoard()) {
      errors.push('Stage must belong to a valid board');
    }

    if (!this.isValidPosition()) {
      errors.push('Stage position must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = Stage;

