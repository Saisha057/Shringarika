/**
 * Bulk Operations Service
 * Handles mass updates for products, orders, and users
 */

import { supabase } from '../config/supabase.js';

/**
 * Bulk update products
 * @param {Array} updates - Array of product updates [{id, ...updates}]
 * @returns {Object} Result with success/failure counts
 */
export const bulkUpdateProducts = async (updates) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      const { id, ...productData } = update;

      if (!id) {
        results.failed += 1;
        results.errors.push({ id, error: 'Product ID is required' });
        continue;
      }

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id);

      if (error) {
        results.failed += 1;
        results.errors.push({ id, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk product update:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk delete products
 * @param {Array} productIds - Array of product IDs to delete
 * @returns {Object} Result with success/failure counts
 */
export const bulkDeleteProducts = async (productIds) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const id of productIds) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        results.failed += 1;
        results.errors.push({ id, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk product delete:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update product stock
 * @param {Array} updates - Array of stock updates [{productId, stockQuantity}]
 * @returns {Object} Result with success/failure counts
 */
export const bulkUpdateStock = async (updates) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      const { productId, stockQuantity } = update;

      if (!productId || stockQuantity === undefined) {
        results.failed += 1;
        results.errors.push({ 
          productId, 
          error: 'Product ID and stock quantity are required' 
        });
        continue;
      }

      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: stockQuantity })
        .eq('id', productId);

      if (error) {
        results.failed += 1;
        results.errors.push({ productId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk stock update:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update order status
 * @param {Array} updates - Array of order updates [{orderId, status}]
 * @returns {Object} Result with success/failure counts
 */
export const bulkUpdateOrders = async (updates) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    for (const update of updates) {
      const { orderId, status } = update;

      if (!orderId || !status) {
        results.failed += 1;
        results.errors.push({ 
          orderId, 
          error: 'Order ID and status are required' 
        });
        continue;
      }

      if (!validStatuses.includes(status)) {
        results.failed += 1;
        results.errors.push({ 
          orderId, 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
        continue;
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        results.failed += 1;
        results.errors.push({ orderId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk order update:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk cancel orders
 * @param {Array} orderIds - Array of order IDs to cancel
 * @returns {Object} Result with success/failure counts
 */
export const bulkCancelOrders = async (orderIds) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const orderId of orderIds) {
      // Check if order can be cancelled (not already delivered)
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        results.failed += 1;
        results.errors.push({ orderId, error: 'Order not found' });
        continue;
      }

      if (order.status === 'delivered') {
        results.failed += 1;
        results.errors.push({ orderId, error: 'Cannot cancel delivered order' });
        continue;
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        results.failed += 1;
        results.errors.push({ orderId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk order cancellation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update users
 * @param {Array} updates - Array of user updates [{userId, ...updates}]
 * @returns {Object} Result with success/failure counts
 */
export const bulkUpdateUsers = async (updates) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      const { userId, ...userData } = update;

      if (!userId) {
        results.failed += 1;
        results.errors.push({ userId, error: 'User ID is required' });
        continue;
      }

      // Don't allow changing password or email through bulk operations
      delete userData.password;
      delete userData.email;

      const { error } = await supabase
        .from('users')
        .update({
          ...userData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        results.failed += 1;
        results.errors.push({ userId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk user update:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk activate/deactivate users
 * @param {Array} userIds - Array of user IDs
 * @param {Boolean} isActive - Whether to activate or deactivate
 * @returns {Object} Result with success/failure counts
 */
export const bulkToggleUsers = async (userIds, isActive) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const userId of userIds) {
      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        results.failed += 1;
        results.errors.push({ userId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk user toggle:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk delete users
 * @param {Array} userIds - Array of user IDs to delete
 * @returns {Object} Result with success/failure counts
 */
export const bulkDeleteUsers = async (userIds) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const userId of userIds) {
      // Don't allow deleting admin users
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (fetchError) {
        results.failed += 1;
        results.errors.push({ userId, error: 'User not found' });
        continue;
      }

      if (user.role === 'admin' || user.role === 'super_admin') {
        results.failed += 1;
        results.errors.push({ userId, error: 'Cannot delete admin users' });
        continue;
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        results.failed += 1;
        results.errors.push({ userId, error: error.message });
      } else {
        results.success += 1;
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Error in bulk user delete:', error);
    return { success: false, error: error.message };
  }
};

export default {
  bulkUpdateProducts,
  bulkDeleteProducts,
  bulkUpdateStock,
  bulkUpdateOrders,
  bulkCancelOrders,
  bulkUpdateUsers,
  bulkToggleUsers,
  bulkDeleteUsers,
};
