/**
 * Admin Dashboard Routes
 * Central API endpoints for admin dashboard data retrieval
 */

import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/admin/orders
 * Get all orders with optional filtering
 * Query params: status, payment_status, page, limit
 */
router.get('/orders', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('📋 [Admin Orders] Fetching all orders...');
    const { status, payment_status, page = 1, limit = 20 } = req.query;

    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .or('is_archived.is.null,is_archived.eq.false') // Exclude archived orders from main list
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('order_status', status);
    }
    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 20;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('❌ [Admin Orders] Error fetching orders:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch orders',
        error: error.message,
      });
    }

    // Fetch order_items for each order
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('❌ [Admin Orders] Error fetching order items:', itemsError);
      } else {
        // Group items by order_id
        const itemsByOrderId = {};
        
        // Fetch product images for items
        const productIds = [...new Set(orderItems.map(item => item.product_id).filter(Boolean))];
        let productImagesMap = {};
        
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, images, image')
            .in('id', productIds);
          
          if (products) {
            products.forEach(p => {
              const images = p.images || [];
              productImagesMap[p.id] = images[0] || p.image || null;
            });
          }
        }
        
        orderItems.forEach(item => {
          if (!itemsByOrderId[item.order_id]) {
            itemsByOrderId[item.order_id] = [];
          }
          itemsByOrderId[item.order_id].push({
            productId: item.product_id,
            productName: item.product_name,
            variant: item.variant_info || {},
            quantity: item.quantity,
            pricePerItem: parseFloat(item.unit_price),
            lineTotal: parseFloat(item.total_price),
            image: productImagesMap[item.product_id] || null
          });
        });

        // Attach order_items to each order
        orders.forEach(order => {
          order.order_items = itemsByOrderId[order.id] || [];
        });
      }
    }

    console.log(`✅ [Admin Orders] Fetched ${orders?.length || 0} orders with items (total: ${count})`);

    res.json({
      status: 'success',
      data: {
        orders: orders || [],
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: count,
          pages: Math.ceil((count || 0) / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching orders',
    });
  }
});

/**
 * GET /api/admin/users
 * Get all users with statistics
 * Query params: role, page, limit
 */
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('👥 [Admin Users] Fetching all users...');
    const { role, page = 1, limit = 100 } = req.query;

    // Use admin client to bypass RLS
    const supabase = getSupabaseAdmin();

    // Get all users - NOTE: users table does NOT have a 'name' column
    // Names are stored in the 'profiles' table
    let userQuery = supabase
      .from('users')
      .select('id, email, role, is_active, last_login, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (role && role !== 'all') {
      userQuery = userQuery.eq('role', role);
    }

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 100;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    userQuery = userQuery.range(from, to);

    const { data: users, error: usersError, count } = await userQuery;

    if (usersError) {
      console.error('❌ [Admin Users] Error fetching users:', usersError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch users',
        error: usersError.message,
      });
    }

    // Get profiles to get names
    const userIds = (users || []).map(u => u.id);
    let profilesMap = {};
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', userIds);
      
      if (!profilesError && profiles) {
        profiles.forEach(p => {
          profilesMap[p.user_id] = p;
        });
      }
    }

    // Get all orders for stats calculation
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, payment_status, order_status, payment_method, created_at, is_paid');

    if (ordersError) {
      console.warn('⚠️  [Admin Users] Warning: Could not fetch orders for stats:', ordersError);
    }

    console.log('[Dashboard] Raw orders sample:',
      (allOrders || []).slice(0, 3).map(o => ({
        id: o.id ? String(o.id).slice(0, 8) : null,
        total_amount: o.total_amount,
        total: o.total,
        amount: o.amount,
        status: o.order_status,
        type_of_total: typeof o.total_amount,
      }))
    );

    // Enrich users with statistics and profile data
    const usersWithStats = (users || []).map(user => {
      const profile = profilesMap[user.id] || {};
      const userOrders = (allOrders || []).filter(order => order.user_id === user.id);

      const totalSpent = userOrders.reduce((sum, order) => {
        const isPaid = order.is_paid || order.payment_status === 'paid';
        return sum + (isPaid ? Number(order.total_amount || 0) : 0);
      }, 0);

      // Count COD and Prepaid orders
      const codOrders = userOrders.filter(o => o.payment_method === 'COD' || o.payment_method === 'cod').length;
      const prepaidOrders = userOrders.filter(o => o.payment_method !== 'COD' && o.payment_method !== 'cod').length;

      // Count orders by status
      const ordersByStatus = {
        pending: userOrders.filter(o => o.order_status === 'pending').length,
        confirmed: userOrders.filter(o => o.order_status === 'confirmed').length,
        processing: userOrders.filter(o => o.order_status === 'processing').length,
        packed: userOrders.filter(o => o.order_status === 'packed').length,
        shipped: userOrders.filter(o => o.order_status === 'shipped').length,
        delivered: userOrders.filter(o => o.order_status === 'delivered').length,
        cancelled: userOrders.filter(o => o.order_status === 'cancelled').length,
        returned: userOrders.filter(o => o.order_status === 'returned').length,
        refunded: userOrders.filter(o => o.order_status === 'refunded').length,
      };

      // Build name from profile or use email
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

      return {
        id: user.id,
        name: name,
        email: user.email,
        phone: profile.phone || null,
        role: user.role,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
        stats: {
          totalOrders: userOrders.length,
          totalSpent: Math.round(totalSpent * 100) / 100,
          lastOrderDate: userOrders.length > 0 
            ? new Date(Math.max(...userOrders.map(o => new Date(o.created_at).getTime()))).toISOString()
            : null,
          codOrders,
          prepaidOrders,
          ordersByStatus,
        },
      };
    });

    console.log(`✅ [Admin Users] Fetched ${usersWithStats?.length || 0} users (total: ${count})`);

    res.json({
      status: 'success',
      data: {
        users: usersWithStats || [],
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: count,
          pages: Math.ceil((count || 0) / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('❌ [Admin Users] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching users',
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a specific user account
 */
router.delete('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`🗑️ [Admin Users] Deleting user: ${userId}`);

    // Delete user's orders first
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('user_id', userId);

    if (ordersError) {
      console.error('❌ [Admin Users] Error deleting user orders:', ordersError);
    }

    // Delete user's profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId);

    if (profileError) {
      console.error('❌ [Admin Users] Error deleting user profile:', profileError);
    }

    // Delete user account
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('❌ [Admin Users] Error deleting user account:', userError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete user account',
      });
    }

    console.log(`✅ [Admin Users] User ${userId} deleted successfully`);

    res.json({
      status: 'success',
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('❌ [Admin Users] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting user',
    });
  }
});

/**
 * GET /api/admin/dashboard
 * Get dashboard overview with key metrics
 */
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('📊 [Admin Dashboard] Fetching dashboard metrics...');
    const rawStartDate = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const rawEndDate = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;

    const supabase = getSupabaseAdmin();

    // Build date filters
    const parsedStartDate = rawStartDate
      ? new Date(rawStartDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const parsedEndDate = rawEndDate ? new Date(rawEndDate) : new Date();

    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      console.warn('⚠️ [Admin Dashboard] Invalid date filters', {
        startDate: rawStartDate,
        endDate: rawEndDate,
      });
      return res.status(400).json({
        status: 'error',
        message: 'Invalid startDate or endDate query parameter',
      });
    }

    if (parsedStartDate > parsedEndDate) {
      console.warn('⚠️ [Admin Dashboard] startDate greater than endDate', {
        startDate: parsedStartDate.toISOString(),
        endDate: parsedEndDate.toISOString(),
      });
      return res.status(400).json({
        status: 'error',
        message: 'startDate must be before or equal to endDate',
      });
    }

    const startDateFilter = parsedStartDate.toISOString();
    const endDateFilter = parsedEndDate.toISOString();

    // Get all orders
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, payment_status, order_status, created_at, is_paid')
      .gte('created_at', startDateFilter)
      .lte('created_at', endDateFilter);

    if (ordersError) {
      console.error('❌ [Admin Dashboard] Error fetching orders:', {
        message: ordersError.message,
        code: ordersError.code,
        details: ordersError.details,
        hint: ordersError.hint,
        startDateFilter,
        endDateFilter,
      });
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch dashboard data',
      });
    }

    // Get total users
    const { count: totalUsers, error: totalUsersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (totalUsersError) {
      console.error('❌ [Admin Dashboard] Error fetching total users:', {
        message: totalUsersError.message,
        code: totalUsersError.code,
        details: totalUsersError.details,
        hint: totalUsersError.hint,
      });
    }

    // Get new users in period
    const { count: newUsers, error: newUsersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDateFilter)
      .lte('created_at', endDateFilter);

    if (newUsersError) {
      console.error('❌ [Admin Dashboard] Error fetching new users:', {
        message: newUsersError.message,
        code: newUsersError.code,
        details: newUsersError.details,
        hint: newUsersError.hint,
        startDateFilter,
        endDateFilter,
      });
    }

    // Calculate metrics
    const totalOrders = allOrders?.length || 0;
    const totalRevenue = (allOrders || [])
      .filter((o) => String(o.order_status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, order) => {
      const amount = Number(order.total_amount)
        || Number(order.total)
        || Number(order.amount)
        || 0;
      return sum + amount;
    }, 0);

    const deliveredOrders = (allOrders || []).filter(o => String(o.order_status || '').toLowerCase() === 'delivered').length;
    const cancelledOrders = (allOrders || []).filter(o => String(o.order_status || '').toLowerCase() === 'cancelled').length;
    const pendingOrders = (allOrders || []).filter(o => String(o.order_status || '').toLowerCase() === 'pending').length;

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

    // Group orders by date for chart
    const ordersByDate = {};
    (allOrders || []).forEach(order => {
      const createdAtDate = new Date(order.created_at);
      if (Number.isNaN(createdAtDate.getTime())) {
        return;
      }
      const date = createdAtDate.toISOString().split('T')[0];
      if (!ordersByDate[date]) {
        ordersByDate[date] = { date, orders: 0, revenue: 0 };
      }
      ordersByDate[date].orders += 1;
      if (order.is_paid || order.payment_status === 'paid') {
        ordersByDate[date].revenue += Number(order.total_amount || 0);
      }
    });

    const recentOrders = (allOrders || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    console.log(`✅ [Admin Dashboard] Dashboard metrics ready:
      Total Revenue: ₹${totalRevenue}
      Total Orders: ${totalOrders}
      Total Users: ${totalUsers || 0}
      New Users (period): ${newUsers || 0}
    `);

    res.json({
      status: 'success',
      data: {
        metrics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          totalUsers: totalUsers || 0,
          newUsers: newUsers || 0,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          completionRate: Math.round(completionRate * 100) / 100,
          deliveredOrders,
          cancelledOrders,
          pendingOrders,
        },
        charts: {
          ordersByDate: Object.values(ordersByDate),
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error('❌ [Admin Dashboard] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard data',
    });
  }
});

/**
 * GET /api/admin/orders/archived
 * Get all archived orders
 */
router.get('/orders/archived', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('📦 [Admin Orders] Fetching archived orders...');
    const supabase = getSupabaseAdmin();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });

    if (error) {
      console.error('❌ [Admin Orders] Error fetching archived orders:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    // Fetch order_items for each archived order
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      const itemsByOrderId = {};
      (orderItems || []).forEach(item => {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          product_id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          size: (item.variant_info && item.variant_info.size) || '',
          price: parseFloat(item.unit_price || 0),
          pricePerItem: parseFloat(item.unit_price || 0),
        });
      });
      orders.forEach(o => { o.order_items = itemsByOrderId[o.id] || []; });
    }

    console.log(`✅ [Admin Orders] Fetched ${orders?.length || 0} archived orders`);
    res.json({ status: 'success', data: orders || [] });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({ status: 'error', message: 'Server error fetching archived orders' });
  }
});

/**
 * POST /api/admin/orders/archive-old
 * Archive all delivered orders that are 7+ days old
 */
router.post('/orders/archive-old', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('📦 [Admin Orders] Archiving delivered orders 7+ days old...');
    const supabase = getSupabaseAdmin();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('orders')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: (req.user && req.user.email) || 'admin',
      })
      .eq('order_status', 'Delivered')
      .or('is_archived.is.null,is_archived.eq.false')
      .lte('updated_at', sevenDaysAgo.toISOString())
      .select('id');

    if (error) {
      console.error('❌ [Admin Orders] Error archiving old orders:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    const count = (data && data.length) || 0;
    console.log(`✅ [Admin Orders] Archived ${count} old delivered orders`);
    res.json({ status: 'success', archived: count, message: `${count} orders archived successfully` });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({ status: 'error', message: 'Server error archiving old orders' });
  }
});

/**
 * PATCH /api/admin/orders/:id/archive
 * Archive a single order
 */
router.patch('/orders/:id/archive', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📦 [Admin Orders] Archiving order: ${id}`);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: (req.user && req.user.email) || 'admin',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [Admin Orders] Error archiving order:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    console.log(`✅ [Admin Orders] Order ${id} archived`);
    res.json({ status: 'success', data, message: 'Order archived successfully' });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({ status: 'error', message: 'Server error archiving order' });
  }
});

/**
 * PATCH /api/admin/orders/:id/unarchive
 * Unarchive a single order (restore to active orders)
 */
router.patch('/orders/:id/unarchive', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📤 [Admin Orders] Unarchiving order: ${id}`);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [Admin Orders] Error unarchiving order:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    console.log(`✅ [Admin Orders] Order ${id} unarchived`);
    res.json({ status: 'success', data, message: 'Order unarchived successfully' });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({ status: 'error', message: 'Server error unarchiving order' });
  }
});

/**
 * DELETE /api/admin/orders/:id/complete
 * Mark order as complete and delete from database
 * Only for delivered orders
 */
router.delete('/orders/:id/complete', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ [Admin Orders] Deleting completed order: ${id}`);

    const supabase = getSupabaseAdmin();

    // 1. Check order exists and is delivered
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('order_status')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    if (order.order_status?.toLowerCase() !== 'delivered') {
      return res.status(400).json({
        status: 'error',
        message: 'Only delivered orders can be marked as complete and deleted',
      });
    }

    // 2. Delete order_items first (foreign key constraint)
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id);

    if (itemsError) {
      console.error('❌ [Admin Orders] Error deleting order items:', itemsError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete order items',
      });
    }

    // 3. Delete order
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (orderError) {
      console.error('❌ [Admin Orders] Error deleting order:', orderError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete order',
      });
    }

    console.log(`✅ [Admin Orders] Order ${id} marked as complete and deleted`);

    res.json({
      status: 'success',
      message: 'Order marked as complete and removed from database',
    });
  } catch (error) {
    console.error('❌ [Admin Orders] Server error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting order',
    });
  }
});

export default router;
