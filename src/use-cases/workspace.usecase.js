const Workspace = require('../entities/Workspace');
const WorkspaceMember = require('../entities/WorkspaceMember');
const WorkspaceModel = require('../database/models/WorkspaceModel');
const WorkspaceMemberModel = require('../database/models/WorkspaceMemberModel');
const UserModel = require('../database/models/UserModel');

class WorkspaceUseCase {
  async createWorkspace({ name, description, isPrivate = true, userId }) {
    const workspace = new Workspace({
      name,
      description,
      ownerId: userId,
      isPrivate,
    });

    const validation = workspace.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
  
    const workspaceDoc = await WorkspaceModel.create({
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      isPrivate: workspace.isPrivate,
    });

    await WorkspaceMemberModel.create({
      workspaceId: workspaceDoc._id,
      userId: userId,
      role: 'admin',
      joinedAt: new Date(),
    });

    return workspaceDoc.toSafeObject();
  }

  async getUserWorkspaces(userId) {
    const memberships = await WorkspaceMemberModel.find({ userId })
      .populate('workspaceId')
      .sort({ createdAt: -1 });

    const workspaces = memberships
      .filter(m => m.workspaceId)
      .map(m => ({
        ...m.workspaceId.toSafeObject(),
        memberRole: m.role,
        joinedAt: m.joinedAt,
      }));

    return workspaces;
  }

  async getWorkspaceById(workspaceId, userId) {
    const workspace = await WorkspaceModel.findById(workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    return {
      ...workspace.toSafeObject(),
      memberRole: membership.role,
    };
  }

  async updateWorkspace(workspaceId, userId, updateData) {
    const workspace = await WorkspaceModel.findById(workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership || !membership.isAdmin()) {
      throw new Error('Only admins can update workspace settings');
    }

    const allowedUpdates = ['name', 'description', 'isPrivate'];
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        workspace[key] = updateData[key];
      }
    });

    await workspace.save();
    return workspace.toSafeObject();
  }

  async deleteWorkspace(workspaceId, userId) {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId.toString() !== userId.toString()) {
      throw new Error('Only the workspace owner can delete it');
    }

    // Delete workspace members first
    await WorkspaceMemberModel.deleteMany({ workspaceId });

    // Delete the workspace
    await WorkspaceModel.findByIdAndDelete(workspaceId);

    // TODO: Add cleanup logic for related data (boards, stages, cards, comments)
    // This will be implemented later

    return {
      message: 'Workspace deleted successfully.',
      workspaceId,
      status: 'deleted'
    };
  }

  async generateInviteLink(workspaceId, userId, expiryDays = 7) {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership || !membership.canManageMembers()) {
      throw new Error('Only admins can generate invite links');
    }

    workspace.generateInviteCode(expiryDays);
    await workspace.save();

    return workspace.toObjectWithInvite();
  }

  async joinWorkspaceViaInvite(inviteCode, userId) {
    const workspace = await WorkspaceModel.findOne({ inviteCode });

    if (!workspace) {
      throw new Error('Invalid invite code');
    }

    if (!workspace.isInviteCodeValid()) {
      throw new Error('Invite code has expired');
    }

    const existingMembership = await WorkspaceMemberModel.findOne({
      workspaceId: workspace._id,
      userId,
    });

    if (existingMembership) {
      throw new Error('You are already a member of this workspace');
    }

    const membership = await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId,
      role: 'member',
      joinedAt: new Date(),
    });

    return {
      workspace: workspace.toSafeObject(),
      membership: membership.toSafeObject(),
    };
  }

  async getWorkspaceMembers(workspaceId, userId) {
    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership) {
      throw new Error('You are not a member of this workspace');
    }

    const members = await WorkspaceMemberModel.find({ workspaceId })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: 1 });

    return members.map(m => ({
      id: m._id,
      user: {
        id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        avatar: m.userId.avatar,
      },
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async removeMember(workspaceId, userId, memberIdToRemove) {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership || !membership.canManageMembers()) {
      throw new Error('Only admins can remove members');
    }

    if (workspace.ownerId.toString() === memberIdToRemove.toString()) {
      throw new Error('Cannot remove the workspace owner');
    }

    const result = await WorkspaceMemberModel.findOneAndDelete({
      workspaceId,
      userId: memberIdToRemove,
    });

    if (!result) {
      throw new Error('Member not found in this workspace');
    }

    return { message: 'Member removed successfully' };
  }

  async updateMemberRole(workspaceId, userId, memberIdToUpdate, newRole) {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const membership = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId,
    });

    if (!membership || !membership.canManageMembers()) {
      throw new Error('Only admins can update member roles');
    }

    if (workspace.ownerId.toString() === memberIdToUpdate.toString()) {
      throw new Error('Cannot change the workspace owner\'s role');
    }

    const validRoles = Object.values(WorkspaceMember.ROLES);
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const memberToUpdate = await WorkspaceMemberModel.findOne({
      workspaceId,
      userId: memberIdToUpdate,
    });

    if (!memberToUpdate) {
      throw new Error('Member not found in this workspace');
    }

    memberToUpdate.role = newRole;
    await memberToUpdate.save();

    return memberToUpdate.toSafeObject();
  }
}

module.exports = new WorkspaceUseCase();

