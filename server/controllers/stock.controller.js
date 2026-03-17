import { getSupabase } from '../config/supabase.js';

// @desc    Get variant-level stock for a product (REAL-TIME)
// @route   GET /api/stock/variant/:productId
// @access  Public
export const getVariantStock = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID is required',
      });
    }

    const supabase = getSupabase();

    // Fetch all active variants for this product with stock levels
    const { data: variants, error } = await supabase
      .from('product_inventory')
      .select('id, product_id, size, color, stock, low_stock_threshold, is_active, updated_at')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('size', { ascending: true });

    if (error) {
      console.error('Error fetching variant stock:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch stock information',
      });
    }

    // Transform data into structured format: { size: { color: stock } }
    const stockMap = {};
    variants.forEach(variant => {
      const size = variant.size;
      const color = variant.color || 'default';
      const stock = variant.stock;
      const isLowStock = stock <= (variant.low_stock_threshold || 10);

      if (!stockMap[size]) {
        stockMap[size] = {};
      }

      stockMap[size][color] = {
        stock,
        isLowStock,
        variantId: variant.id,
        updatedAt: variant.updated_at
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        productId,
        variants: stockMap,
        timestamp: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error('getVariantStock error:', error);
    next(error);
  }
};

// @desc    Check stock availability for items
// @route   POST /api/stock/check-availability
// @access  Public
export const checkStockAvailability = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Items array is required',
      });
    }

    const supabase = getSupabase();

    // Call database function to check availability
    const { data, error } = await supabase.rpc('check_stock_availability', {
      p_items: items,
    });

    if (error) {
      console.error('Error checking stock availability:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to check stock availability',
      });
    }

    res.status(200).json({
      status: 'success',
      data: data,
    });
  } catch (error) {
    console.error('checkStockAvailability error:', error);
    next(error);
  }
};

// @desc    Deduct stock when order is placed
// @route   POST /api/stock/deduct
// @access  Private (Internal - called by order controller)
export const deductStock = async (req, res, next) => {
  try {
    const { orderId, items } = req.body;

    if (!orderId || !items) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID and items are required',
      });
    }

    const supabase = getSupabase();

    // Call database function to deduct stock
    const { data, error } = await supabase.rpc('deduct_stock_on_order', {
      p_order_id: orderId,
      p_items: items,
    });

    if (error) {
      console.error('Error deducting stock:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to deduct stock',
      });
    }

    // Check if all items were successfully deducted
    const failedItems = data.results.filter(r => !r.success);
    if (failedItems.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient stock for some items',
        data: data,
      });
    }

    console.log(`✅ Stock deducted for order ${orderId}`);

    res.status(200).json({
      status: 'success',
      data: data,
      message: 'Stock deducted successfully',
    });
  } catch (error) {
    console.error('deductStock error:', error);
    next(error);
  }
};

// @desc    Restore stock when order is cancelled
// @route   POST /api/stock/restore
// @access  Private (Internal - called by order controller)
export const restoreStock = async (req, res, next) => {
  try {
    const { orderId, items } = req.body;

    if (!orderId || !items) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID and items are required',
      });
    }

    const supabase = getSupabase();

    // Call database function to restore stock
    const { data, error } = await supabase.rpc('restore_stock_on_cancellation', {
      p_order_id: orderId,
      p_items: items,
    });

    if (error) {
      console.error('Error restoring stock:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to restore stock',
      });
    }

    console.log(`✅ Stock restored for cancelled order ${orderId}`);

    res.status(200).json({
      status: 'success',
      data: data,
      message: 'Stock restored successfully',
    });
  } catch (error) {
    console.error('restoreStock error:', error);
    next(error);
  }
};

// @desc    Update product stock manually (Admin)
// @route   PUT /api/stock/update
// @access  Private/Admin
export const updateProductStock = async (req, res, next) => {
  try {
    const { productId, variant, quantity, reason, changeType } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Product ID and quantity are required',
      });
    }

    const supabase = getSupabase();
    const adminId = req.user.id;

    // Get current stock
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('total_stock, stock')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    let currentStock, newStock;

    if (!variant) {
      // Update main product stock
      currentStock = product.total_stock || 0;
      newStock = parseInt(quantity);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          total_stock: newStock,
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateError) {
        console.error('Error updating product stock:', updateError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update stock',
        });
      }
    } else {
      // Update variant stock
      const stockData = product.stock || {};
      currentStock = stockData[variant] || 0;
      newStock = parseInt(quantity);

      stockData[variant] = newStock;

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: stockData,
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateError) {
        console.error('Error updating variant stock:', updateError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update variant stock',
        });
      }
    }

    // Log stock change
    const { error: logError } = await supabase
      .from('stock_history')
      .insert([{
        product_id: productId,
        variant: variant || null,
        change_type: changeType || 'manual_add',
        quantity_change: newStock - currentStock,
        quantity_before: currentStock,
        quantity_after: newStock,
        reason: reason || 'Manual stock update by admin',
        admin_id: adminId,
        metadata: {
          admin_id: adminId,
          timestamp: new Date().toISOString(),
        },
      }]);

    if (logError) {
      console.error('Error logging stock change:', logError);
    }

    // Update stock alert
    const { error: alertError } = await supabase.rpc('update_stock_alert', {
      p_product_id: productId,
      p_variant: variant || null,
    });

    if (alertError) {
      console.error('Error updating stock alert:', alertError);
    }

    console.log(`✅ Stock updated: ${productId}${variant ? ` (${variant})` : ''} → ${newStock}`);

    res.status(200).json({
      status: 'success',
      data: {
        productId,
        variant,
        oldStock: currentStock,
        newStock: newStock,
        change: newStock - currentStock,
      },
      message: 'Stock updated successfully',
    });
  } catch (error) {
    console.error('updateProductStock error:', error);
    next(error);
  }
};

// @desc    Get stock history for a product
// @route   GET /api/stock/history/:productId
// @access  Private/Admin
export const getStockHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { variant, limit = 50 } = req.query;

    const supabase = getSupabase();

    let query = supabase
      .from('stock_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (variant) {
      query = query.eq('variant', variant);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Error fetching stock history:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch stock history',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { history },
    });
  } catch (error) {
    console.error('getStockHistory error:', error);
    next(error);
  }
};

// @desc    Get stock alerts (low/critical stock products)
// @route   GET /api/stock/alerts
// @access  Private/Admin
export const getStockAlerts = async (req, res, next) => {
  try {
    const { level } = req.query;

    const supabase = getSupabase();

    let query = supabase
      .from('stock_alerts')
      .select(`
        *,
        products!stock_alerts_product_id_fkey (id, name, images, price, category)
      `)
      .eq('alert_enabled', true)
      .order('alert_level', { ascending: true })
      .order('current_stock', { ascending: true });

    if (level && ['critical', 'low', 'warning'].includes(level)) {
      query = query.eq('alert_level', level);
    } else {
      // By default, only show critical, low, and warning (not 'ok')
      query = query.in('alert_level', ['critical', 'low', 'warning']);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching stock alerts:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch stock alerts',
      });
    }

    // Group by alert level
    const groupedAlerts = {
      critical: alerts.filter(a => a.alert_level === 'critical'),
      low: alerts.filter(a => a.alert_level === 'low'),
      warning: alerts.filter(a => a.alert_level === 'warning'),
    };

    res.status(200).json({
      status: 'success',
      data: {
        alerts,
        grouped: groupedAlerts,
        counts: {
          critical: groupedAlerts.critical.length,
          low: groupedAlerts.low.length,
          warning: groupedAlerts.warning.length,
          total: alerts.length,
        },
      },
    });
  } catch (error) {
    console.error('getStockAlerts error:', error);
    next(error);
  }
};

// @desc    Update stock alert thresholds
// @route   PUT /api/stock/alerts/:productId
// @access  Private/Admin
export const updateStockAlertThresholds = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { variant, thresholdCritical, thresholdLow, thresholdWarning } = req.body;

    const supabase = getSupabase();

    // Get current stock
    const { data: product } = await supabase
      .from('products')
      .select('total_stock, stock')
      .eq('id', productId)
      .single();

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      });
    }

    const currentStock = variant 
      ? (product.stock?.[variant] || 0)
      : (product.total_stock || 0);

    // Calculate new alert level
    let alertLevel = 'ok';
    if (currentStock <= (thresholdCritical || 0)) {
      alertLevel = 'critical';
    } else if (currentStock <= (thresholdLow || 5)) {
      alertLevel = 'low';
    } else if (currentStock <= (thresholdWarning || 10)) {
      alertLevel = 'warning';
    }

    // Update or insert alert
    const { data, error } = await supabase
      .from('stock_alerts')
      .upsert({
        product_id: productId,
        variant: variant || null,
        alert_level: alertLevel,
        current_stock: currentStock,
        threshold_critical: thresholdCritical || 0,
        threshold_low: thresholdLow || 5,
        threshold_warning: thresholdWarning || 10,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating stock alert:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update stock alert',
      });
    }

    console.log(`✅ Stock alert thresholds updated for ${productId}${variant ? ` (${variant})` : ''}`);

    res.status(200).json({
      status: 'success',
      data: { alert: data },
      message: 'Alert thresholds updated successfully',
    });
  } catch (error) {
    console.error('updateStockAlertThresholds error:', error);
    next(error);
  }
};

// @desc    Get low stock products view
// @route   GET /api/stock/low-stock
// @access  Private/Admin
export const getLowStockProducts = async (req, res, next) => {
  try {
    const supabase = getSupabase();

    const { data: products, error } = await supabase
      .from('low_stock_products')
      .select('*')
      .order('alert_level', { ascending: true })
      .order('total_stock', { ascending: true });

    if (error) {
      console.error('Error fetching low stock products:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock products',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error) {
    console.error('getLowStockProducts error:', error);
    next(error);
  }
};

// @desc    Get out of stock products view
// @route   GET /api/stock/out-of-stock
// @access  Private/Admin
export const getOutOfStockProducts = async (req, res, next) => {
  try {
    const supabase = getSupabase();

    const { data: products, error } = await supabase
      .from('out_of_stock_products')
      .select('*')
      .order('stock_updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching out of stock products:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch out of stock products',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error) {
    console.error('getOutOfStockProducts error:', error);
    next(error);
  }
};

// @desc    Get recent stock changes view
// @route   GET /api/stock/recent-changes
// @access  Private/Admin
export const getRecentStockChanges = async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;

    const supabase = getSupabase();

    const { data: changes, error } = await supabase
      .from('recent_stock_changes')
      .select('*')
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching recent stock changes:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch recent stock changes',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { changes },
    });
  } catch (error) {
    console.error('getRecentStockChanges error:', error);
    next(error);
  }
};

// @desc    Bulk update stock for multiple products
// @route   POST /api/stock/bulk-update
// @access  Private/Admin
export const bulkUpdateStock = async (req, res, next) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Updates array is required',
      });
    }

    const supabase = getSupabase();
    const adminId = req.user.id;
    const results = [];

    for (const update of updates) {
      const { productId, variant, quantity, reason } = update;

      try {
        // Get current stock
        const { data: product } = await supabase
          .from('products')
          .select('total_stock, stock')
          .eq('id', productId)
          .single();

        if (!product) {
          results.push({
            productId,
            variant,
            success: false,
            error: 'Product not found',
          });
          continue;
        }

        let currentStock, newStock;

        if (!variant) {
          currentStock = product.total_stock || 0;
          newStock = parseInt(quantity);

          await supabase
            .from('products')
            .update({
              total_stock: newStock,
              stock_updated_at: new Date().toISOString(),
            })
            .eq('id', productId);
        } else {
          const stockData = product.stock || {};
          currentStock = stockData[variant] || 0;
          newStock = parseInt(quantity);
          stockData[variant] = newStock;

          await supabase
            .from('products')
            .update({
              stock: stockData,
              stock_updated_at: new Date().toISOString(),
            })
            .eq('id', productId);
        }

        // Log stock change
        await supabase.from('stock_history').insert([{
          product_id: productId,
          variant: variant || null,
          change_type: 'manual_add',
          quantity_change: newStock - currentStock,
          quantity_before: currentStock,
          quantity_after: newStock,
          reason: reason || 'Bulk stock update',
          admin_id: adminId,
        }]);

        // Update alert
        await supabase.rpc('update_stock_alert', {
          p_product_id: productId,
          p_variant: variant || null,
        });

        results.push({
          productId,
          variant,
          success: true,
          oldStock: currentStock,
          newStock,
        });
      } catch (error) {
        results.push({
          productId,
          variant,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Bulk stock update: ${successCount}/${updates.length} successful`);

    res.status(200).json({
      status: 'success',
      data: {
        results,
        summary: {
          total: updates.length,
          successful: successCount,
          failed: updates.length - successCount,
        },
      },
      message: `Bulk update complete: ${successCount}/${updates.length} successful`,
    });
  } catch (error) {
    console.error('bulkUpdateStock error:', error);
    next(error);
  }
};
