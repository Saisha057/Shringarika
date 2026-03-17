/**
 * Recommendation Routes
 * 
 * Endpoints for product recommendations:
 * - Personalized recommendations
 * - Similar products
 * - Frequently bought together
 * - Trending products
 * - New arrivals
 * - Best sellers
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getTrendingProducts,
  getNewArrivals,
  getBestSellers,
} from '../services/recommendations.service.js';

const router = express.Router();

/**
 * @route   GET /api/recommendations/personalized
 * @desc    Get personalized product recommendations for logged-in user
 * @access  Private
 */
router.get('/personalized', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const recommendations = await getPersonalizedRecommendations(req.user.id, limit);
    
    res.json({
      status: 'success',
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error) {
    console.error('Personalized recommendations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching personalized recommendations',
    });
  }
});

/**
 * @route   GET /api/recommendations/similar/:productId
 * @desc    Get similar products (You may also like)
 * @access  Public
 */
router.get('/similar/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 6;
    
    const products = await getSimilarProducts(productId, limit);
    
    res.json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Similar products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching similar products',
    });
  }
});

/**
 * @route   GET /api/recommendations/frequently-bought/:productId
 * @desc    Get frequently bought together products
 * @access  Public
 */
router.get('/frequently-bought/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 3;
    
    const products = await getFrequentlyBoughtTogether(productId, limit);
    
    res.json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Frequently bought together error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching frequently bought together products',
    });
  }
});

/**
 * @route   GET /api/recommendations/trending
 * @desc    Get trending products
 * @access  Public
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const products = await getTrendingProducts(limit);
    
    res.json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Trending products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching trending products',
    });
  }
});

/**
 * @route   GET /api/recommendations/new-arrivals
 * @desc    Get new arrival products
 * @access  Public
 */
router.get('/new-arrivals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const products = await getNewArrivals(limit);
    
    res.json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('New arrivals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching new arrivals',
    });
  }
});

/**
 * @route   GET /api/recommendations/best-sellers
 * @desc    Get best selling products
 * @access  Public
 */
router.get('/best-sellers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const products = await getBestSellers(limit);
    
    res.json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Best sellers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching best sellers',
    });
  }
});

export default router;
