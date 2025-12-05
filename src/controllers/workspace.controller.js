const workspaceUseCase = require('../use-cases/workspace.usecase');

class WorkspaceController {
  async createWorkspace(req, res) {
    try {
      const { name, description, isPrivate } = req.body;
      const userId = req.userId;

      const workspace = await workspaceUseCase.createWorkspace({
        name,
        description,
        isPrivate,
        userId,
      });

      res.status(201).json({
        status: 'success',
        message: 'Workspace created successfully',
        data: workspace,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getUserWorkspaces(req, res) {
    try {
      const userId = req.userId;
      const workspaces = await workspaceUseCase.getUserWorkspaces(userId);

      res.status(200).json({
        status: 'success',
        data: workspaces,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getWorkspaceById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const workspace = await workspaceUseCase.getWorkspaceById(id, userId);

      res.status(200).json({
        status: 'success',
        data: workspace,
      });
    } catch (error) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateWorkspace(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const updateData = req.body;

      const workspace = await workspaceUseCase.updateWorkspace(id, userId, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Workspace updated successfully',
        data: workspace,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async deleteWorkspace(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await workspaceUseCase.deleteWorkspace(id, userId);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async generateInviteLink(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { expiryDays } = req.body;

      const workspace = await workspaceUseCase.generateInviteLink(
        id,
        userId,
        expiryDays || 7
      );

      res.status(200).json({
        status: 'success',
        message: 'Invite link generated successfully',
        data: workspace,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async joinWorkspace(req, res) {
    try {
      const { inviteCode } = req.params;
      const userId = req.userId;

      const result = await workspaceUseCase.joinWorkspaceViaInvite(inviteCode, userId);

      res.status(200).json({
        status: 'success',
        message: 'Successfully joined workspace',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getWorkspaceMembers(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const members = await workspaceUseCase.getWorkspaceMembers(id, userId);

      res.status(200).json({
        status: 'success',
        data: members,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async removeMember(req, res) {
    try {
      const { id, memberId } = req.params;
      const userId = req.userId;

      const result = await workspaceUseCase.removeMember(id, userId, memberId);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async updateMemberRole(req, res) {
    try {
      const { id, memberId } = req.params;
      const userId = req.userId;
      const { role } = req.body;

      const member = await workspaceUseCase.updateMemberRole(id, userId, memberId, role);

      res.status(200).json({
        status: 'success',
        message: 'Member role updated successfully',
        data: member,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

module.exports = new WorkspaceController();

