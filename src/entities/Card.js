class Card {
  constructor({
    id,
    title,
    description,
    stageId,
    boardId,
    position,
    assignedTo = [],
    dueDate,
    priority = 'medium',
    labels = [],
    createdBy,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.stageId = stageId;
    this.boardId = boardId;
    this.position = position;
    this.assignedTo = assignedTo;
    this.dueDate = dueDate;
    this.priority = priority;
    this.labels = labels;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static get PRIORITIES() {
    return {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      URGENT: 'urgent'
    };
  }

  isValidTitle() {
    return this.title && this.title.trim().length >= 1 && this.title.length <= 200;
  }

  isValidDescription() {
    if (!this.description) return true;
    return this.description.length <= 2000;
  }

  hasValidStage() {
    return this.stageId && this.stageId.toString().length > 0;
  }

  hasValidBoard() {
    return this.boardId && this.boardId.toString().length > 0;
  }

  isValidPosition() {
    return typeof this.position === 'number' && this.position >= 0;
  }

  isValidPriority() {
    const validPriorities = Object.values(Card.PRIORITIES);
    return validPriorities.includes(this.priority);
  }

  hasValidCreator() {
    return this.createdBy && this.createdBy.toString().length > 0;
  }

  validate() {
    const errors = [];

    if (!this.isValidTitle()) {
      errors.push('Card title must be between 1 and 200 characters');
    }

    if (!this.isValidDescription()) {
      errors.push('Description must not exceed 2000 characters');
    }

    if (!this.hasValidStage()) {
      errors.push('Card must belong to a valid stage');
    }

    if (!this.hasValidBoard()) {
      errors.push('Card must belong to a valid board');
    }

    if (!this.isValidPosition()) {
      errors.push('Card position must be a non-negative number');
    }

    if (!this.isValidPriority()) {
      errors.push('Priority must be one of: low, medium, high, urgent');
    }

    if (!this.hasValidCreator()) {
      errors.push('Card must have a valid creator');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = Card;

