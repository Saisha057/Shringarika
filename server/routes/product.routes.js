import express from 'express';
import { body } from 'express-validator';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  searchProducts,
  addSingleVariant,
  autoGenerateVariants,
  getProductVariants,
} from '../controllers/product.controller.supabase.js';
import {
  getProductColors,
  getProductSizes,
  getProductVariants as getProductVariantsDynamic
} from '../controllers/variants.dynamic.controller.js';
import { protect, authorize, admin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import variantsRouter from './variants.routes.js';
import reviews from '../store/reviews.store.js';

const router = express.Router();

// Validation rules
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isNumeric().withMessage('Price must be a number').isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('category').notEmpty().withMessage('Category is required'),
];

const reviewValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Comment is required'),
];

// Public routes
router.get('/search', searchProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.get('/:id/variants', getProductVariants);

// NEW: Dynamic variant endpoints (fetch from product_inventory)
router.get('/:id/colors', getProductColors);
router.get('/:id/sizes', getProductSizes);
router.get('/:id/variants-dynamic', getProductVariantsDynamic);

// Admin routes - Protected with authentication and authorization
router.post('/', protect, authorize('admin'), productValidation, validate, createProduct);
router.put('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.put('/:id/stock', protect, authorize('admin'), updateStock);
router.patch('/:id/stock', protect, authorize('admin'), updateStock); // PATCH alias for frontend compatibility

// Variant management routes
router.post('/:id/single-variant', protect, authorize('admin'), addSingleVariant);
router.post('/:id/auto-variants', protect, authorize('admin'), autoGenerateVariants);

// Bulk variant stock update route - MUST be before variants router to avoid conflict
router.put('/:id/variants/stock', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { variants } = req.body;

    console.log('📝 Updating variant: stock', req.body);

    if (!variants || !Array.isArray(variants)) {
      return res.status(400).json({
        status: 'error',
        message: 'Variants array is required'
      });
    }

    const supabase = getSupabaseAdmin();

    // Update each variant stock
    const updatePromises = variants.map(async (variant) => {
      const { size, stock } = variant;
      
      const { data, error } = await supabase
        .from('product_inventory')
        .update({ stock: stock })
        .eq('product_id', id)
        .eq('size', size);

      if (error) throw error;
      return { size, stock, success: true };
    });

    const results = await Promise.all(updatePromises);

    res.json({
      status: 'success',
      message: 'Variant stock updated successfully',
      data: results
    });
  } catch (error) {
    console.error('❌ Error updating variant stock:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update variant stock',
      error: error.message
    });
  }
});

// Mount variants router for advanced variant management (protected routes only)
// This handles routes like: /api/products/:productId/variants/:variantId (PUT/DELETE)
// and /api/products/:productId/variants/stats, /low-stock, /bulk
router.use('/:productId/variants', variantsRouter);

// ── Reviews alias routes ──────────────────────────────────────────────────────
// Frontend calls POST/GET /api/products/:id/reviews.
// These handlers use the shared reviews store so data is consistent with /api/reviews.
//
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id: productId } = req.params;
    const productReviews = Array.from(reviews.values())
      .filter(r => r.productId === productId)
      .map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        title: r.title || '',
        user: { name: r.userName || 'Anonymous' },
        created_at: r.createdAt,
        helpful: r.helpful || 0,
        verified: r.verified || false,
      }));

    const avgRating = productReviews.length > 0
      ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
      : 0;

    res.json({
      reviews: productReviews,
      averageRating: avgRating,
      totalReviews: productReviews.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const productId = req.params.id;
    const { rating, comment, title } = req.body;
    const userId = req.user.id;

    if (!rating) {
      return res.status(400).json({ message: 'Rating is required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const existingReview = Array.from(reviews.values()).find(
      r => r.productId === productId && r.userId === userId
    );
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    const reviewId = Date.now().toString();
    const newReview = {
      id: reviewId,
      productId,
      userId,
      userName: req.user.name,
      rating,
      title: title || '',
      comment: comment || '',
      createdAt: new Date().toISOString(),
      helpful: 0,
      verified: false,
    };

    reviews.set(reviewId, newReview);

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
});

export default router;
