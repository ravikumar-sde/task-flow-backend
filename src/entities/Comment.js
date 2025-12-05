class Comment {
  constructor({
    id,
    content,
    cardId,
    userId,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.content = content;
    this.cardId = cardId;
    this.userId = userId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isValidContent() {
    return this.content && this.content.trim().length >= 1 && this.content.length <= 2000;
  }

  hasValidCard() {
    return this.cardId && this.cardId.toString().length > 0;
  }

  hasValidUser() {
    return this.userId && this.userId.toString().length > 0;
  }

  validate() {
    const errors = [];

    if (!this.isValidContent()) {
      errors.push('Comment content must be between 1 and 2000 characters');
    }

    if (!this.hasValidCard()) {
      errors.push('Comment must belong to a valid card');
    }

    if (!this.hasValidUser()) {
      errors.push('Comment must have a valid user');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = Comment;

