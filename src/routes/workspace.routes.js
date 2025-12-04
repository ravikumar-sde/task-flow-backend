const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspace.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body, param } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

const createWorkspaceValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Workspace name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
];

const updateWorkspaceValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Workspace name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
];

const inviteLinkValidation = [
  body('expiryDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Expiry days must be between 1 and 365'),
];

const updateMemberRoleValidation = [
  body('role')
    .isIn(['admin', 'member', 'viewer'])
    .withMessage('Role must be one of: admin, member, viewer'),
];

router.post('/', authenticate, createWorkspaceValidation, validate, workspaceController.createWorkspace);
router.get('/', authenticate, workspaceController.getUserWorkspaces);
router.post('/join/:inviteCode', authenticate, workspaceController.joinWorkspace);
router.get('/:id', authenticate, workspaceController.getWorkspaceById);
router.put('/:id', authenticate, updateWorkspaceValidation, validate, workspaceController.updateWorkspace);
router.delete('/:id', authenticate, workspaceController.deleteWorkspace);
router.post('/:id/invite', authenticate, inviteLinkValidation, validate, workspaceController.generateInviteLink);
router.get('/:id/members', authenticate, workspaceController.getWorkspaceMembers);
router.delete('/:id/members/:memberId', authenticate, workspaceController.removeMember);
router.patch('/:id/members/:memberId', authenticate, updateMemberRoleValidation, validate, workspaceController.updateMemberRole);

module.exports = router;

