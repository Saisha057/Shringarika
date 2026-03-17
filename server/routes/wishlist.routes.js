import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from '../controllers/wishlist.controller.supabase.js';

const router = express.Router();

// All wishlist routes require authentication
router.use(protect);

// Wishlist routes
router.get('/', getUserWishlist);
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);
router.delete('/', clearWishlist);

export default router;
