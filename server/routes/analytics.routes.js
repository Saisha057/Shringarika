import express from 'express';
import { protect, admin } from '../middleware/auth.middleware.js';
import { getAnalytics } from '../controllers/analytics.controller.js';

const router = express.Router();

// All analytics routes require admin access
router.use(protect, admin);

// Main analytics endpoint used by AdminAnalytics component
router.get('/', getAnalytics);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    // Mock data - replace with real database queries
    const stats = {
      totalRevenue: 125000,
      totalOrders: 245,
      totalCustomers: 180,
      totalProducts: 65,
      revenueGrowth: 12.5,
      ordersGrowth: 8.3,
      customersGrowth: 15.2,
      productsGrowth: 5.1,
      recentOrders: [],
      topSellingProducts: [],
      revenueByMonth: [
        { month: 'Jan', revenue: 8500 },
        { month: 'Feb', revenue: 12000 },
        { month: 'Mar', revenue: 15000 },
        { month: 'Apr', revenue: 18000 },
        { month: 'May', revenue: 20000 },
        { month: 'Jun', revenue: 22500 },
      ],
      ordersByStatus: {
        pending: 12,
        processing: 28,
        shipped: 45,
        delivered: 150,
        cancelled: 10,
      },
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
});

// Get sales report
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Mock data - replace with real database queries
    const salesReport = {
      period: { startDate, endDate },
      totalRevenue: 45000,
      totalOrders: 89,
      averageOrderValue: 505.62,
      salesByDate: [
        { date: '2024-11-20', orders: 12, revenue: 6000 },
        { date: '2024-11-21', orders: 15, revenue: 7500 },
        { date: '2024-11-22', orders: 18, revenue: 9000 },
        { date: '2024-11-23', orders: 20, revenue: 10000 },
        { date: '2024-11-24', orders: 14, revenue: 7000 },
        { date: '2024-11-25', orders: 10, revenue: 5500 },
      ],
      topProducts: [
        { name: 'AROHI COLLECTION', orders: 45, revenue: 15000 },
        { name: 'MEHANDI GREEN', orders: 32, revenue: 12000 },
        { name: 'PINK SUIT', orders: 28, revenue: 9000 },
      ],
    };

    res.json(salesReport);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales report', error: error.message });
  }
});

// Get top products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10, sortBy = 'sales' } = req.query;

    // Mock data - replace with real database queries
    const topProducts = [
      {
        id: '1',
        name: 'AROHI COLLECTION',
        category: 'Ethnic Wear',
        totalSales: 45,
        revenue: 22500,
        views: 1250,
        conversionRate: 3.6,
      },
      {
        id: '2',
        name: 'MEHANDI GREEN',
        category: 'Suits',
        totalSales: 38,
        revenue: 19000,
        views: 980,
        conversionRate: 3.9,
      },
      {
        id: '3',
        name: 'PINK SUIT',
        category: 'Suits',
        totalSales: 32,
        revenue: 16000,
        views: 850,
        conversionRate: 3.8,
      },
    ];

    res.json(topProducts.slice(0, parseInt(limit)));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top products', error: error.message });
  }
});

// Get customer insights
router.get('/customers', async (req, res) => {
  try {
    // Mock data - replace with real database queries
    const insights = {
      totalCustomers: 180,
      newCustomersThisMonth: 25,
      returningCustomers: 95,
      averageOrdersPerCustomer: 2.8,
      customerLifetimeValue: 2500,
      topCustomers: [
        { name: 'Priya Sharma', orders: 12, totalSpent: 15000 },
        { name: 'Anjali Verma', orders: 10, totalSpent: 12000 },
        { name: 'Neha Patel', orders: 9, totalSpent: 11000 },
      ],
      customersByLocation: [
        { city: 'Mumbai', customers: 45 },
        { city: 'Delhi', customers: 38 },
        { city: 'Bangalore', customers: 32 },
        { city: 'Pune', customers: 28 },
        { city: 'Hyderabad', customers: 22 },
      ],
    };

    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer insights', error: error.message });
  }
});

// Get inventory report
router.get('/inventory', async (req, res) => {
  try {
    // Mock data - replace with real database queries
    const inventoryReport = {
      totalProducts: 65,
      lowStockProducts: 8,
      outOfStockProducts: 3,
      totalValue: 450000,
      productsNeedingRestock: [
        { name: 'AROHI COLLECTION', currentStock: 2, reorderLevel: 10 },
        { name: 'MEHANDI GREEN', currentStock: 3, reorderLevel: 10 },
        { name: 'PINK SUIT', currentStock: 1, reorderLevel: 5 },
      ],
      stockByCategory: [
        { category: 'Ethnic Wear', products: 25, value: 180000 },
        { category: 'Suits', products: 20, value: 150000 },
        { category: 'Accessories', products: 20, value: 120000 },
      ],
    };

    res.json(inventoryReport);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory report', error: error.message });
  }
});

// Get revenue trends
router.get('/revenue-trends', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    // Mock data - replace with real database queries
    const trends = {
      period,
      currentPeriod: {
        revenue: 22500,
        orders: 89,
        averageOrderValue: 252.81,
      },
      previousPeriod: {
        revenue: 18000,
        orders: 72,
        averageOrderValue: 250.00,
      },
      growth: {
        revenue: 25.0,
        orders: 23.6,
        averageOrderValue: 1.1,
      },
      dailyRevenue: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 2000) + 500,
      })),
    };

    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching revenue trends', error: error.message });
  }
});

export default router;
