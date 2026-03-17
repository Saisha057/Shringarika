import express from 'express';
import {
  getVariantStock,
  checkStockAvailability,
  deductStock,
  restoreStock,
  updateProductStock,
  getStockHistory,
  getStockAlerts,
  updateStockAlertThresholds,
  getLowStockProducts,
  getOutOfStockProducts,
  getRecentStockChanges,
  bulkUpdateStock,
} from '../controllers/stock.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/variant/:productId', getVariantStock); // Real-time variant stock endpoint
router.post('/check-availability', checkStockAvailability);

// Private routes (internal use by order controller)
router.post('/deduct', protect, deductStock);
router.post('/restore', protect, restoreStock);

// Admin routes
router.put('/update', protect, admin, updateProductStock);
router.post('/bulk-update', protect, admin, bulkUpdateStock);
router.get('/history/:productId', protect, admin, getStockHistory);
router.get('/alerts', protect, admin, getStockAlerts);
router.put('/alerts/:productId', protect, admin, updateStockAlertThresholds);
router.get('/low-stock', protect, admin, getLowStockProducts);
router.get('/out-of-stock', protect, admin, getOutOfStockProducts);
router.get('/recent-changes', protect, admin, getRecentStockChanges);

export default router;
