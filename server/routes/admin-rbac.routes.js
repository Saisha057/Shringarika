/**
 * RBAC Routes
 * Role-Based Access Control management
 */

import express from 'express';
import { body, param } from 'express-validator';
import {
  getAllRoles,
  getUserRoleAndPermissions,
  assignRole,
  getRoleHistory,
  getUsersByRole,
} from '../services/rbac.service.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { audit } from '../middleware/audit.middleware.js';

const router = express.Router();

/**
 * GET /api/admin/rbac/roles
 * Get all available roles with their permissions
 */
router.get('/roles', protect, authorize('admin'), async (req, res) => {
  try {
    const result = getAllRoles();
    res.json(result);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/admin/rbac/users/:userId
 * Get user's role and permissions
 */
router.get(
  '/users/:userId',
  protect,
  authorize('admin'),
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await getUserRoleAndPermissions(userId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching user role:', error);
      res.status(500).json({ error: 'Failed to fetch user role' });
    }
  }
);

/**
 * POST /api/admin/rbac/users/:userId/role
 * Assign role to user
 */
router.post(
  '/users/:userId/role',
  protect,
  authorize('admin'),
  audit('assign_role', 'user'),
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    body('role')
      .isIn(['super_admin', 'admin', 'manager', 'support', 'user'])
      .withMessage('Invalid role'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const result = await assignRole(userId, role, req.user.id);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        message: 'Role assigned successfully',
        data: result.data,
      });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({ error: 'Failed to assign role' });
    }
  }
);

/**
 * GET /api/admin/rbac/users/:userId/history
 * Get role assignment history for a user
 */
router.get(
  '/users/:userId/history',
  protect,
  authorize('admin'),
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await getRoleHistory(userId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching role history:', error);
      res.status(500).json({ error: 'Failed to fetch role history' });
    }
  }
);

/**
 * GET /api/admin/rbac/roles/:role/users
 * Get all users with a specific role
 */
router.get(
  '/roles/:role/users',
  protect,
  authorize('admin'),
  [
    param('role')
      .isIn(['super_admin', 'admin', 'manager', 'support', 'user'])
      .withMessage('Invalid role'),
  ],
  validate,
  async (req, res) => {
    try {
      const { role } = req.params;

      const result = await getUsersByRole(role);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

export default router;
