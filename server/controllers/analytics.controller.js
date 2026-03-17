import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';

// Get analytics data
export const getAnalytics = async (req, res, next) => {
  try {
    const { range = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    console.log(`📊 Fetching analytics from ${startDate.toISOString()} to ${now.toISOString()}`);
    
    // Get all orders within date range
    const allOrders = await Order.findAll();
    const orders = allOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= startDate && orderDate <= now;
    });
    
    console.log(`📦 Total orders in range: ${orders.length}`);
    
    // Calculate total revenue (only from paid orders)
    const totalRevenue = orders.reduce((sum, order) => {
      const isPaid = order.is_paid || order.payment_status === 'paid';
      const orderTotal = isPaid ? (order.total_price || 0) : 0;
      return sum + Number(orderTotal);
    }, 0);

    // Total orders
    const totalOrders = orders.length;

    // Get all products
    const products = await Product.findAll();
    const totalProducts = products.length;

    // Calculate total unique customers (user_id or guest_uuid)
    const uniqueCustomerIds = new Set();
    orders.forEach(order => {
      if (order.user_id) {
        uniqueCustomerIds.add(`user_${order.user_id}`);
      } else if (order.guest_uuid) {
        uniqueCustomerIds.add(`guest_${order.guest_uuid}`);
      }
    });
    const totalCustomers = uniqueCustomerIds.size;

    // Average order value (only paid orders)
    const paidOrders = orders.filter(o => o.is_paid || o.payment_status === 'paid');
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Top products by revenue (from order items)
    const productSales = {};
    orders.forEach(order => {
      const orderItems = order.order_items || [];
      orderItems.forEach(item => {
        const productId = item.productId || item.product;
        const productName = item.productName || item.name;
        
        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name: productName,
            sales: 0,
            revenue: 0
          };
        }
        productSales[productId].sales += Number(item.quantity || 0);
        const itemRevenue = (item.lineTotal || (item.price * item.quantity)) || 0;
        productSales[productId].revenue += Number(itemRevenue);
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        sales: p.sales,
        revenue: Math.round(p.revenue)
      }));

    console.log(`🏆 Top 5 products:`, topProducts);

    // Sales by category (from actual product data and order items)
    const categorySales = {};
    
    // Build category map from products
    const productCategoryMap = {};
    products.forEach(product => {
      productCategoryMap[product.id] = product.category || 'Uncategorized';
    });
    
    // Aggregate sales by category
    orders.forEach(order => {
      const orderItems = order.order_items || [];
      orderItems.forEach(item => {
        const productId = item.productId || item.product;
        const category = productCategoryMap[productId] || 'Uncategorized';
        
        if (!categorySales[category]) {
          categorySales[category] = 0;
        }
        
        const itemRevenue = (item.lineTotal || (item.price * item.quantity)) || 0;
        categorySales[category] += Number(itemRevenue);
      });
    });

    const totalCategorySales = Object.values(categorySales).reduce((sum, val) => sum + Number(val), 0);
    const salesByCategory = Object.entries(categorySales)
      .map(([category, revenue]) => ({
        category,
        value: totalCategorySales > 0 ? Math.round((Number(revenue) / totalCategorySales) * 100) : 0,
        revenue: Math.round(Number(revenue))
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    console.log(`📊 Sales by category:`, salesByCategory);

    // Revenue by month (last 6 months)
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const monthYear = `${monthName} ${date.getFullYear()}`;
      
      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.getMonth() === date.getMonth() && 
               orderDate.getFullYear() === date.getFullYear();
      });
      
      const monthRevenue = monthOrders.reduce((sum, order) => {
        const isPaid = order.is_paid || order.payment_status === 'paid';
        return sum + (isPaid ? Number(order.total_price || 0) : 0);
      }, 0);
      
      revenueByMonth.push({
        month: monthYear,
        revenue: Math.round(monthRevenue),
        orders: monthOrders.length
      });
    }

    console.log(`📈 Revenue by month:`, revenueByMonth);

    // Recent activity (last 10 orders with real timestamps)
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
    
    const recentActivity = recentOrders.map(order => {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      const diffMs = now.getTime() - orderDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      let timeAgo;
      if (diffDays > 0) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        timeAgo = diffMinutes > 0 ? `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago` : 'Just now';
      }
      
      return {
        type: 'order',
        description: `Order ${order.order_number || '#' + order.id?.slice(0, 8)} - ₹${Number(order.total_price).toFixed(2)}`,
        timestamp: timeAgo
      };
    });

    // Conversion rate calculation (orders / total customers * 100)
    // This is a simplified metric - in production you'd track sessions/visitors
    const conversionRate = totalCustomers > 0 ? 
      Math.round((totalOrders / totalCustomers) * 100 * 10) / 10 : 0;
    
    const analyticsData = {
      totalRevenue: Math.round(totalRevenue),
      totalOrders,
      totalProducts,
      totalCustomers,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      conversionRate,
      topProducts,
      salesByCategory,
      revenueByMonth,
      recentActivity,
    };
    
    console.log(`✅ Analytics summary:`, {
      totalRevenue: `₹${analyticsData.totalRevenue}`,
      totalOrders: analyticsData.totalOrders,
      totalCustomers: analyticsData.totalCustomers,
      avgOrderValue: `₹${analyticsData.avgOrderValue}`
    });
    
    res.json(analyticsData);
  } catch (error) {
    console.error('❌ Error in getAnalytics:', error);
    next(error);
  }
};
