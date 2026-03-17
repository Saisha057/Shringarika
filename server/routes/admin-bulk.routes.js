/**
 * Bulk Operations Routes
 * Handles mass updates for admin operations
 */

import express from 'express';
import { body } from 'express-validator';
import {
  bulkUpdateProducts,
  bulkDeleteProducts,
  bulkUpdateStock,
  bulkUpdateOrders,
  bulkCancelOrders,
  bulkUpdateUsers,
  bulkToggleUsers,
  bulkDeleteUsers,
} from '../services/bulkOperations.service.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

/**
 * POST /api/admin/bulk/products/update
 * Bulk update products
 * Body: { updates: [{id, name, price, ...}] }
 */
router.post(
  '/products/update',
  protect,
  authorize('admin'),
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.id').notEmpty().withMessage('Product ID is required for each update'),
  ],
  validate,
  async (req, res) => {
    try {
      const { updates } = req.body;

      const result = await bulkUpdateProducts(updates);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully updated ${result.data.success} products`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk product update:', error);
      res.status(500).json({ error: 'Failed to update products' });
    }
  }
);

/**
 * POST /api/admin/bulk/products/delete
 * Bulk delete products
 * Body: { productIds: [1, 2, 3] }
 */
router.post(
  '/products/delete',
  protect,
  authorize('admin'),
  [
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { productIds } = req.body;

      const result = await bulkDeleteProducts(productIds);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully deleted ${result.data.success} products`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk product delete:', error);
      res.status(500).json({ error: 'Failed to delete products' });
    }
  }
);

/**
 * POST /api/admin/bulk/products/stock
 * Bulk update product stock
 * Body: { updates: [{productId, stockQuantity}] }
 */
router.post(
  '/products/stock',
  protect,
  authorize('admin'),
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.productId').notEmpty().withMessage('Product ID is required'),
    body('updates.*.stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive integer'),
  ],
  validate,
  async (req, res) => {
    try {
      const { updates } = req.body;

      const result = await bulkUpdateStock(updates);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully updated stock for ${result.data.success} products`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk stock update:', error);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  }
);

/**
 * POST /api/admin/bulk/orders/update
 * Bulk update order status
 * Body: { updates: [{orderId, status}] }
 */
router.post(
  '/orders/update',
  protect,
  authorize('admin'),
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.orderId').notEmpty().withMessage('Order ID is required'),
    body('updates.*.status')
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid order status'),
  ],
  validate,
  async (req, res) => {
    try {
      const { updates } = req.body;

      const result = await bulkUpdateOrders(updates);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully updated ${result.data.success} orders`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk order update:', error);
      res.status(500).json({ error: 'Failed to update orders' });
    }
  }
);

/**
 * POST /api/admin/bulk/orders/cancel
 * Bulk cancel orders
 * Body: { orderIds: [1, 2, 3] }
 */
router.post(
  '/orders/cancel',
  protect,
  authorize('admin'),
  [
    body('orderIds').isArray({ min: 1 }).withMessage('Order IDs array is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { orderIds } = req.body;

      const result = await bulkCancelOrders(orderIds);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully cancelled ${result.data.success} orders`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk order cancellation:', error);
      res.status(500).json({ error: 'Failed to cancel orders' });
    }
  }
);

/**
 * POST /api/admin/bulk/users/update
 * Bulk update users
 * Body: { updates: [{userId, name, role, ...}] }
 */
router.post(
  '/users/update',
  protect,
  authorize('admin'),
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.userId').notEmpty().withMessage('User ID is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { updates } = req.body;

      const result = await bulkUpdateUsers(updates);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully updated ${result.data.success} users`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk user update:', error);
      res.status(500).json({ error: 'Failed to update users' });
    }
  }
);

/**
 * POST /api/admin/bulk/users/toggle
 * Bulk activate/deactivate users
 * Body: { userIds: [1, 2, 3], isActive: true/false }
 */
router.post(
  '/users/toggle',
  protect,
  authorize('admin'),
  [
    body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userIds, isActive } = req.body;

      const result = await bulkToggleUsers(userIds, isActive);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      const action = isActive ? 'activated' : 'deactivated';
      res.json({
        success: true,
        message: `Successfully ${action} ${result.data.success} users`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk user toggle:', error);
      res.status(500).json({ error: 'Failed to toggle users' });
    }
  }
);

/**
 * POST /api/admin/bulk/users/delete
 * Bulk delete users
 * Body: { userIds: [1, 2, 3] }
 */
router.post(
  '/users/delete',
  protect,
  authorize('admin'),
  [
    body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { userIds } = req.body;

      const result = await bulkDeleteUsers(userIds);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Successfully deleted ${result.data.success} users`,
        data: result.data,
      });
    } catch (error) {
      console.error('Error in bulk user delete:', error);
      res.status(500).json({ error: 'Failed to delete users' });
    }
  }
);

export default router;
