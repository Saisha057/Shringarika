/**
 * Admin Analytics Routes
 * Provides detailed analytics and reports for admin dashboard
 */

import express from 'express';
import {
  getAnalyticsOverview,
  getSalesAnalytics,
  getUserAnalytics,
  getProductAnalytics,
  getRevenueAnalytics,
} from '../services/analytics.service.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/admin/analytics/overview
 * Get comprehensive analytics overview
 * Query params: startDate, endDate
 */
router.get('/overview', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getAnalyticsOverview({ startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * GET /api/admin/analytics/sales
 * Get sales analytics with trends
 * Query params: startDate, endDate, groupBy (hour/day/week/month)
 */
router.get('/sales', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const result = await getSalesAnalytics({ startDate, endDate, groupBy });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

/**
 * GET /api/admin/analytics/users
 * Get user analytics and behavior
 * Query params: startDate, endDate
 */
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getUserAnalytics({ startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

/**
 * GET /api/admin/analytics/products
 * Get product performance analytics
 * Query params: startDate, endDate
 */
router.get('/products', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getProductAnalytics({ startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ error: 'Failed to fetch product analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue analytics with detailed breakdown
 * Query params: startDate, endDate
 */
router.get('/revenue', protect, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getRevenueAnalytics({ startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

export default router;
