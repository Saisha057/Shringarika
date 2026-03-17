/**
 * Audit Logs Routes
 * Provides access to audit logs for admin monitoring
 */

import express from 'express';
import { query } from 'express-validator';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditStatistics,
  getEntityHistory,
  getUserActivity,
  cleanupOldLogs,
} from '../services/auditLogs.service.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filters
 * Query params: userId, action, entityType, startDate, endDate, page, limit
 */
router.get(
  '/',
  protect,
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userId, action, entityType, startDate, endDate, page, limit } = req.query;

      const result = await getAuditLogs({
        userId,
        action,
        entityType,
        startDate,
        endDate,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

/**
 * GET /api/admin/audit-logs/:id
 * Get a specific audit log by ID
 */
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await getAuditLogById(id);

    if (!result.success) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /api/admin/audit-logs/statistics
 * Get audit logs statistics
 * Query params: startDate, endDate
 */
router.get('/stats/overview', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getAuditStatistics({ startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

/**
 * GET /api/admin/audit-logs/entity/:entityType/:entityId
 * Get change history for a specific entity
 */
router.get('/entity/:entityType/:entityId', protect, authorize('admin'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const result = await getEntityHistory(entityType, entityId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching entity history:', error);
    res.status(500).json({ error: 'Failed to fetch entity history' });
  }
});

/**
 * GET /api/admin/audit-logs/user/:userId
 * Get activity logs for a specific user
 * Query params: limit
 */
router.get(
  '/user/:userId',
  protect,
  authorize('admin'),
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      const result = await getUserActivity(userId, limit ? parseInt(limit) : undefined);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  }
);

/**
 * DELETE /api/admin/audit-logs/cleanup
 * Delete old audit logs
 * Query params: daysOld (default: 90)
 */
router.delete(
  '/cleanup',
  protect,
  authorize('admin'),
  [
    query('daysOld').optional().isInt({ min: 1 }).withMessage('Days old must be a positive integer'),
  ],
  validate,
  async (req, res) => {
    try {
      const { daysOld } = req.query;

      const result = await cleanupOldLogs(daysOld ? parseInt(daysOld) : undefined);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Deleted ${result.data.deletedCount} old audit logs`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      res.status(500).json({ error: 'Failed to cleanup audit logs' });
    }
  }
);

export default router;
