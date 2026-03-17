import express from 'express';
import { protect, admin } from '../middleware/auth.middleware.js';
import reviews from '../store/reviews.store.js';

const router = express.Router();

// Get all reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const productReviews = Array.from(reviews.values())
      .filter(review => review.productId === productId)
      .map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        title: review.title || '',
        user: {
          name: review.userName || 'Anonymous'
        },
        created_at: review.createdAt,
        helpful: review.helpful || 0,
        verified: review.verified || false
      }));

    // Calculate average rating
    const avgRating = productReviews.length > 0
      ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length
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

// Create a review
router.post('/', protect, async (req, res) => {
  try {
    const { productId, rating, comment, title } = req.body;
    const userId = req.user.id;

    // Validation
    if (!productId || !rating) {
      return res.status(400).json({ message: 'Product ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user already reviewed this product
    const existingReview = Array.from(reviews.values()).find(
      review => review.productId === productId && review.userId === userId
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
      verified: false, // Set to true if user purchased this product
    };

    reviews.set(reviewId, newReview);

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
});

// Update a review
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, title } = req.body;
    const userId = req.user.id;

    const review = reviews.get(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.userId !== userId) {
      return res.status(403).json({ message: 'You can only edit your own reviews' });
    }

    // Validation
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Update review
    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    if (title !== undefined) review.title = title;
    review.updatedAt = new Date().toISOString();

    reviews.set(id, review);

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: 'Error updating review', error: error.message });
  }
});

// Delete a review
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const review = reviews.get(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review or is admin
    if (review.userId !== userId && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    reviews.delete(id);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error: error.message });
  }
});

// Mark review as helpful
router.post('/:id/helpful', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const review = reviews.get(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.helpful += 1;
    reviews.set(id, review);

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: 'Error marking review as helpful', error: error.message });
  }
});

// Get user's reviews (for profile page)
router.get('/my-reviews', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const userReviews = Array.from(reviews.values()).filter(
      review => review.userId === userId
    );

    res.json(userReviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

export default router;
