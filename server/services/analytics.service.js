/**
 * Advanced Analytics Service
 * Provides detailed reports and insights for admin dashboard
 */

// IMPORTANT: Use admin client (service role key) — bypasses RLS so queries can read
// orders, users, order_items etc. without being blocked by row-level security policies.
import { getSupabaseAdmin } from '../config/supabase.js';

/**
 * Get comprehensive analytics overview
 * @param {Object} filters - Date range and other filters
 * @returns {Object} Analytics overview data
 */
export const getAnalyticsOverview = async (filters = {}) => {
  const supabase = getSupabaseAdmin();
  try {
    const { startDate, endDate } = filters;
    
    // Build date filter
    let dateFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    // Get total revenue
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total_amount, order_status, created_at')  // ✅ FIXED: Use total_amount and order_status
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    if (ordersError) throw ordersError;

    const totalRevenue = orders
      .filter(o => o.order_status !== 'Cancelled')
      .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);  // ✅ FIXED

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.order_status === 'Delivered').length;
    const cancelledOrders = orders.filter(o => o.order_status === 'Cancelled').length;
    const pendingOrders = orders.filter(o => o.order_status === 'Pending').length;

    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get new users in period
    const { count: newUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    // Get total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Calculate conversion rate (orders / users)
    const conversionRate = totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      success: true,
      data: {
        revenue: {
          total: totalRevenue.toFixed(2),
          currency: 'USD',
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
          completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
        },
        users: {
          total: totalUsers,
          new: newUsers,
        },
        products: {
          total: totalProducts,
        },
        metrics: {
          conversionRate: conversionRate.toFixed(2),
          avgOrderValue: avgOrderValue.toFixed(2),
        },
      },
    };
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get sales analytics with trends
 * @param {Object} filters - Date range and grouping
 * @returns {Object} Sales analytics data
 */
export const getSalesAnalytics = async (filters = {}) => {
  const supabase = getSupabaseAdmin();
  try {
    const { startDate, endDate, groupBy = 'day' } = filters;

    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_amount, order_status, created_at')  // ✅ FIXED
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group sales by time period
    const salesByPeriod = {};
    orders.forEach(order => {
      if (order.order_status === 'Cancelled') return;  // ✅ FIXED

      const date = new Date(order.created_at);
      let key;

      switch (groupBy) {
        case 'hour':
          key = `${date.toISOString().slice(0, 13)}:00`;
          break;
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().slice(0, 10);
      }

      if (!salesByPeriod[key]) {
        salesByPeriod[key] = { revenue: 0, orders: 0 };
      }

      salesByPeriod[key].revenue += parseFloat(order.total_amount || 0);  // ✅ FIXED
      salesByPeriod[key].orders += 1;
    });

    // Convert to array and calculate trends
    const salesData = Object.entries(salesByPeriod)
      .map(([date, data]) => ({
        date,
        revenue: parseFloat(data.revenue.toFixed(2)),
        orders: data.orders,
        avgOrderValue: parseFloat((data.revenue / data.orders).toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate growth trends
    const latestRevenue = salesData.length > 0 ? salesData[salesData.length - 1].revenue : 0;
    const previousRevenue = salesData.length > 1 ? salesData[salesData.length - 2].revenue : 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((latestRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    return {
      success: true,
      data: {
        salesByPeriod: salesData,
        trends: {
          revenueGrowth: revenueGrowth.toFixed(2),
          totalRevenue: salesData.reduce((sum, d) => sum + d.revenue, 0).toFixed(2),
          totalOrders: salesData.reduce((sum, d) => sum + d.orders, 0),
        },
      },
    };
  } catch (error) {
    console.error('Error getting sales analytics:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user analytics and behavior
 * @param {Object} filters - Date range filters
 * @returns {Object} User analytics data
 */
export const getUserAnalytics = async (filters = {}) => {
  const supabase = getSupabaseAdmin();
  try {
    const { startDate, endDate } = filters;

    // Get users with their order counts
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, created_at, role')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    if (usersError) throw usersError;

    // Get orders for all users
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('user_id, total_amount, order_status, created_at');  // ✅ FIXED

    if (ordersError) throw ordersError;

    // Calculate user segments
    const userStats = users.map(user => {
      const userOrders = orders.filter(o => o.user_id === user.id && o.order_status !== 'Cancelled');  // ✅ FIXED
      const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);  // ✅ FIXED

      return {
        ...user,
        orderCount: userOrders.length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
      };
    });

    // Segment users
    const newUsers = userStats.filter(u => u.orderCount === 0);
    const activeUsers = userStats.filter(u => u.orderCount >= 1 && u.orderCount <= 5);
    const vipUsers = userStats.filter(u => u.orderCount > 5);

    // Calculate retention rate (users who made more than 1 purchase)
    const retainedUsers = userStats.filter(u => u.orderCount > 1).length;
    const retentionRate = users.length > 0 ? (retainedUsers / users.length) * 100 : 0;

    // Top customers
    const topCustomers = userStats
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        orderCount: u.orderCount,
        totalSpent: u.totalSpent,
      }));

    return {
      success: true,
      data: {
        totalUsers: users.length,
        segments: {
          new: newUsers.length,
          active: activeUsers.length,
          vip: vipUsers.length,
        },
        metrics: {
          retentionRate: retentionRate.toFixed(2),
          avgOrdersPerUser: users.length > 0 ? (orders.length / users.length).toFixed(2) : 0,
        },
        topCustomers,
      },
    };
  } catch (error) {
    console.error('Error getting user analytics:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get product performance analytics
 * @param {Object} filters - Date range filters
 * @returns {Object} Product analytics data
 */
export const getProductAnalytics = async (filters = {}) => {
  const supabase = getSupabaseAdmin();
  try {
    const { startDate, endDate } = filters;

    // Get all products (no stock_quantity column — stock lives in product_inventory)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, category, created_at');

    if (productsError) throw productsError;

    // Get stock totals from product_inventory (variants table)
    const { data: inventory } = await supabase
      .from('product_inventory')
      .select('product_id, stock');

    const stockByProduct = {};
    (inventory || []).forEach(inv => {
      stockByProduct[inv.product_id] = (stockByProduct[inv.product_id] || 0) + Number(inv.stock || 0);
    });

    // Get orders with order_items JSONB (NOT a separate table)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('order_items, created_at, total_price, is_paid, payment_status')
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    if (ordersError) throw ordersError;

    // Build per-product sales map from order_items JSONB
    const productSales = {};
    (orders || []).forEach(order => {
      const items = order.order_items || [];
      items.forEach(item => {
        const pid = item.productId || item.product || item.product_id;
        if (!pid) return;
        if (!productSales[pid]) productSales[pid] = { sold: 0, revenue: 0 };
        const qty = Number(item.quantity || 0);
        const itemRevenue = Number(item.lineTotal || (item.price * item.quantity) || 0);
        productSales[pid].sold += qty;
        productSales[pid].revenue += itemRevenue;
      });
    });

    // Calculate product performance
    const productStats = products.map(product => {
      const sales = productSales[product.id] || { sold: 0, revenue: 0 };
      const totalSold = sales.sold;
      const revenue = sales.revenue;
      const stockQty = stockByProduct[product.id] || 0;

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        price: parseFloat(product.price),
        stock: stockQty,
        sold: totalSold,
        revenue: parseFloat(revenue.toFixed(2)),
        turnoverRate: stockQty > 0
          ? (totalSold / (totalSold + stockQty)) * 100
          : 0,
      };
    });

    // Get top selling products
    const topSelling = productStats
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10);

    // Get top revenue products
    const topRevenue = productStats
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Get low stock products
    const lowStock = productStats
      .filter(p => p.stock < 10)
      .sort((a, b) => a.stock - b.stock);

    // Get products by category
    const byCategory = {};
    productStats.forEach(product => {
      if (!byCategory[product.category]) {
        byCategory[product.category] = {
          count: 0,
          revenue: 0,
          sold: 0,
        };
      }
      byCategory[product.category].count += 1;
      byCategory[product.category].revenue += product.revenue;
      byCategory[product.category].sold += product.sold;
    });

    return {
      success: true,
      data: {
        totalProducts: products.length,
        topSelling,
        topRevenue,
        lowStock,
        byCategory,
        metrics: {
          avgTurnoverRate: productStats.length > 0 
            ? (productStats.reduce((sum, p) => sum + p.turnoverRate, 0) / productStats.length).toFixed(2)
            : 0,
          totalRevenue: productStats.reduce((sum, p) => sum + p.revenue, 0).toFixed(2),
          totalSold: productStats.reduce((sum, p) => sum + p.sold, 0),
        },
      },
    };
  } catch (error) {
    console.error('Error getting product analytics:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get revenue analytics with detailed breakdown
 * @param {Object} filters - Date range filters
 * @returns {Object} Revenue analytics data
 */
export const getRevenueAnalytics = async (filters = {}) => {
  const supabase = getSupabaseAdmin();
  try {
    const { startDate, endDate } = filters;

    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_amount, order_status, created_at, payment_method')  // ✅ FIXED
      .gte('created_at', startDate || '2020-01-01')
      .lte('created_at', endDate || new Date().toISOString());

    if (error) throw error;

    // Filter out cancelled orders
    const validOrders = orders.filter(o => o.order_status !== 'Cancelled');  // ✅ FIXED

    // Total revenue
    const totalRevenue = validOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);  // ✅ FIXED

    // Revenue by status
    const byStatus = {
      Pending: 0,
      Confirmed: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
    };

    validOrders.forEach(order => {
      if (byStatus[order.order_status] !== undefined) {  // ✅ FIXED
        byStatus[order.order_status] += parseFloat(order.total_amount || 0);  // ✅ FIXED
      }
    });

    // Revenue by payment method
    const byPaymentMethod = {};
    validOrders.forEach(order => {
      const method = order.payment_method || 'unknown';
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = 0;
      }
      byPaymentMethod[method] += parseFloat(order.total_amount || 0);  // ✅ FIXED
    });

    // Calculate projections (simple linear projection)
    const daysInPeriod = startDate && endDate 
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      : 30;
    
    const dailyAvg = totalRevenue / (daysInPeriod || 1);
    const monthlyProjection = dailyAvg * 30;
    const yearlyProjection = dailyAvg * 365;

    return {
      success: true,
      data: {
        totalRevenue: totalRevenue.toFixed(2),
        byStatus: Object.entries(byStatus).map(([status, revenue]) => ({
          status,
          revenue: revenue.toFixed(2),
          percentage: totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(2) : 0,
        })),
        byPaymentMethod: Object.entries(byPaymentMethod).map(([method, revenue]) => ({
          method,
          revenue: revenue.toFixed(2),
          percentage: totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(2) : 0,
        })),
        projections: {
          daily: dailyAvg.toFixed(2),
          monthly: monthlyProjection.toFixed(2),
          yearly: yearlyProjection.toFixed(2),
        },
        metrics: {
          avgOrderValue: validOrders.length > 0 ? (totalRevenue / validOrders.length).toFixed(2) : 0,
          orderCount: validOrders.length,
        },
      },
    };
  } catch (error) {
    console.error('Error getting revenue analytics:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getAnalyticsOverview,
  getSalesAnalytics,
  getUserAnalytics,
  getProductAnalytics,
  getRevenueAnalytics,
};
