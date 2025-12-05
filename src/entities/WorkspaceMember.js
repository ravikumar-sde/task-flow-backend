class WorkspaceMember {
  constructor({
    id,
    workspaceId,
    userId,
    role = 'member',
    joinedAt,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.role = role;
    this.joinedAt = joinedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static get ROLES() {
    return {
      ADMIN: 'admin',
      MEMBER: 'member',
      VIEWER: 'viewer'
    };
  }

  isValidRole() {
    const validRoles = Object.values(WorkspaceMember.ROLES);
    return validRoles.includes(this.role);
  }

  hasValidWorkspace() {
    return this.workspaceId && this.workspaceId.toString().length > 0;
  }

  hasValidUser() {
    return this.userId && this.userId.toString().length > 0;
  }

  isAdmin() {
    return this.role === WorkspaceMember.ROLES.ADMIN;
  }

  isMember() {
    return this.role === WorkspaceMember.ROLES.MEMBER;
  }

  isViewer() {
    return this.role === WorkspaceMember.ROLES.VIEWER;
  }

  canManageMembers() {
    return this.isAdmin();
  }

  canCreateBoards() {
    return this.isAdmin() || this.isMember();
  }

  canEditBoards() {
    return this.isAdmin() || this.isMember();
  }

  canDeleteBoards() {
    return this.isAdmin();
  }

  canViewBoards() {
    return true;
  }

  validate() {
    const errors = [];

    if (!this.hasValidWorkspace()) {
      errors.push('Valid workspace ID is required');
    }

    if (!this.hasValidUser()) {
      errors.push('Valid user ID is required');
    }

    if (!this.isValidRole()) {
      errors.push(`Role must be one of: ${Object.values(WorkspaceMember.ROLES).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = WorkspaceMember;

