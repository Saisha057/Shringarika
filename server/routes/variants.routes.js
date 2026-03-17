import express from 'express';
import {
  updateVariant,
  deleteVariant,
  getLowStockVariants,
  restockVariant,
  bulkUpdateVariants,
  getVariantStats,
} from '../controllers/variants.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true }); // mergeParams to access :productId from parent router

// Protected routes - require authentication and admin authorization
router.use(protect);
router.use(authorize('admin'));

// Variant statistics
router.get('/stats', getVariantStats);

// Low stock variants
router.get('/low-stock', getLowStockVariants);

// Bulk update variants
router.put('/bulk', bulkUpdateVariants);

// Single variant operations
router.put('/:variantId', updateVariant);
router.delete('/:variantId', deleteVariant);

// Restock operation
router.post('/:variantId/restock', restockVariant);

export default router;
