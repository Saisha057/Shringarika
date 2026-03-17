import express from 'express';
import { query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { audit } from '../middleware/audit.middleware.js';
import {
  exportOrders,
  exportUsers,
  exportProducts,
  exportAnalytics,
  cleanupOldExports
} from '../services/export.service.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/admin/export/orders
 * @desc    Export orders to CSV or PDF
 * @access  Admin
 */
router.get(
  '/orders',
  [
    query('format')
      .isIn(['csv', 'pdf'])
      .withMessage('Format must be csv or pdf'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date'),
    query('status')
      .optional()
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
      .withMessage('Invalid status')
  ],
  audit('export_orders', 'export'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { format, startDate, endDate, status } = req.query;

      const result = await exportOrders({
        format: format || 'csv',
        startDate,
        endDate,
        status
      });

      // Set headers and send file
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.sendFile(result.filePath);
    } catch (error) {
      console.error('Error exporting orders:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/export/users
 * @desc    Export users to CSV or PDF
 * @access  Admin
 */
router.get(
  '/users',
  [
    query('format')
      .isIn(['csv', 'pdf'])
      .withMessage('Format must be csv or pdf'),
    query('role')
      .optional()
      .isIn(['user', 'admin', 'manager', 'support', 'super_admin'])
      .withMessage('Invalid role'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  audit('export_users', 'export'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { format, role, isActive } = req.query;

      const result = await exportUsers({
        format: format || 'csv',
        role,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      });

      // Set headers and send file
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.sendFile(result.filePath);
    } catch (error) {
      console.error('Error exporting users:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/export/products
 * @desc    Export products to CSV or PDF
 * @access  Admin
 */
router.get(
  '/products',
  [
    query('format')
      .isIn(['csv', 'pdf'])
      .withMessage('Format must be csv or pdf'),
    query('category')
      .optional()
      .isString()
      .withMessage('Invalid category'),
    query('inStock')
      .optional()
      .isBoolean()
      .withMessage('inStock must be a boolean')
  ],
  audit('export_products', 'export'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { format, category, inStock } = req.query;

      const result = await exportProducts({
        format: format || 'csv',
        category,
        inStock: inStock !== undefined ? inStock === 'true' : undefined
      });

      // Set headers and send file
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.sendFile(result.filePath);
    } catch (error) {
      console.error('Error exporting products:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/export/analytics
 * @desc    Export analytics data to CSV or PDF
 * @access  Admin
 */
router.get(
  '/analytics',
  [
    query('format')
      .isIn(['csv', 'pdf'])
      .withMessage('Format must be csv or pdf'),
    query('type')
      .isIn(['sales', 'users', 'products'])
      .withMessage('Type must be sales, users, or products'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date')
  ],
  audit('export_analytics', 'export'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { format, type, startDate, endDate } = req.query;

      const result = await exportAnalytics({
        format: format || 'csv',
        type: type || 'sales',
        startDate,
        endDate
      });

      // Set headers and send file
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.sendFile(result.filePath);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/export/cleanup
 * @desc    Cleanup old export files
 * @access  Admin
 */
router.delete(
  '/cleanup',
  [
    query('hoursOld')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('Hours old must be between 1 and 168 (1 week)')
  ],
  audit('cleanup_exports', 'export'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { hoursOld = 24 } = req.query;

      const result = await cleanupOldExports(parseInt(hoursOld));

      res.json(result);
    } catch (error) {
      console.error('Error cleaning up exports:', error);
      next(error);
    }
  }
);

export default router;
