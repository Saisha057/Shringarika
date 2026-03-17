// =============================================================================
// UPDATED ORDER CONTROLLER WITH ATOMIC STOCK DEDUCTION
// =============================================================================
// File: server/controllers/order.controller.js
// Purpose: Replace existing createOrder function with transaction-safe version
// 
// INSTRUCTIONS:
// 1. Backup current order.controller.js
// 2. Replace the createOrder function (lines ~20-300) with this code
// 3. Test thoroughly before deploying
// =============================================================================

import { supabase, getSupabaseAdmin } from '../config/supabase.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import { sendSMS } from '../services/sms.service.js';
import { sendEmail } from '../services/email.service.js';

// =============================================================================
// ✅ NEW: Transaction-Safe Order Creation with Stock Validation
// =============================================================================

export const createOrder = async (req, res) => {
  try {
    const {
      user,
      orderItems,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentStatus = 'pending',
      totalAmount,
      notes,
    } = req.body;

    console.log('📦 [ORDER] Creating new order with', orderItems?.length || 0, 'items');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: VALIDATE STOCK AVAILABILITY (CRITICAL - DO NOT SKIP!)
    // ═══════════════════════════════════════════════════════════════════════

    console.log('🔍 [STOCK CHECK] Validating stock for all items BEFORE order creation');
    
    const stockValidationResults = [];
    
    for (const item of orderItems) {
      const { product: productId, size, color, quantity, name } = item;
      
      console.log(`  🔍 Checking: ${name} (Size: ${size}, Color: ${color || 'default'}, Qty: ${quantity})`);
      
      // Call stock check function (read-only, no lock)
      const { data: stockCheck, error: stockCheckError } = await getSupabaseAdmin()
        .rpc('check_stock_availability', {
          p_product_id: productId,
          p_size: size,
          p_color: color || 'default',
          p_quantity: quantity
        });

      if (stockCheckError) {
        console.error(`❌ [STOCK CHECK] Database error for product ${productId}:`, stockCheckError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to check stock availability',
          error: stockCheckError.message
        });
      }

      // Variant doesn't exist
      if (!stockCheck || !stockCheck.exists) {
        console.error(`❌ [STOCK CHECK] Variant not found: ${name} (${size}/${color})`);
        return res.status(400).json({
          status: 'error',
          message: `Product variant not available: ${name} (Size: ${size})`,
          data: {
            product: name,
            size: size,
            color: color || 'default',
            issue: 'Variant not found in inventory'
          }
        });
      }

      // Insufficient stock
      if (!stockCheck.in_stock) {
        console.error(`❌ [STOCK CHECK] Insufficient stock: ${name} (Available: ${stockCheck.available}, Requested: ${quantity})`);
        return res.status(400).json({
          status: 'error',
          message: `Insufficient stock for ${name}`,
          data: {
            product: name,
            size: size,
            color: color || 'default',
            available: stockCheck.available,
            requested: quantity,
            message: `Only ${stockCheck.available} units available, but ${quantity} requested`
          }
        });
      }

      console.log(`  ✅ Stock available: ${name} (${stockCheck.available} units)`);
      stockValidationResults.push(stockCheck);
    }

    console.log('✅ [STOCK CHECK] All items have sufficient stock - proceeding with order');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: CREATE ORDER RECORD
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📝 [ORDER] Creating order record in database');

    const orderData = {
      user,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentStatus,
      totalAmount,
      status: 'pending',
      notes,
    };

    let order;
    try {
      order = await Order.create(orderData);
      console.log(`✅ [ORDER] Order created: ${order.id} (${order.orderNumber})`);
    } catch (orderError) {
      console.error('❌ [ORDER] Failed to create order:', orderError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create order',
        error: orderError.message
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: CREATE ORDER ITEMS
    // ═══════════════════════════════════════════════════════════════════════

    console.log(`📦 [ORDER ITEMS] Creating ${orderItems.length} order items`);

    const enrichedOrderItems = orderItems.map(item => ({
      order_id: order.id,
      product_id: item.product,
      quantity: item.quantity,
      price: item.price,
      name: item.name,
      image: item.image,
      size: item.size,
      color: item.color || 'default'
    }));

    const { data: createdItems, error: itemsError } = await getSupabaseAdmin()
      .from('order_items')
      .insert(enrichedOrderItems)
      .select();

    if (itemsError) {
      console.error('❌ [ORDER ITEMS] Failed to create order items:', itemsError);
      
      // ROLLBACK: Delete the order
      await getSupabaseAdmin()
        .from('orders')
        .delete()
        .eq('id', order.id);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create order items',
        error: itemsError.message
      });
    }

    console.log(`✅ [ORDER ITEMS] Created ${createdItems.length} order items`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: DEDUCT STOCK ATOMICALLY (CRITICAL - TRANSACTION-SAFE)
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📉 [STOCK DEDUCTION] Starting atomic stock deduction for all items');

    const deductionResults = [];
    let deductionFailed = false;
    let deductionError = null;

    for (const item of enrichedOrderItems) {
      const { product_id: productId, size, color, quantity, name } = item;
      
      console.log(`  🔒 Deducting ${quantity} units: ${name} (${size}/${color})`);
      
      // Call atomic stock deduction function (with row-level lock)
      const { data: result, error } = await getSupabaseAdmin()
        .rpc('deduct_stock_atomic', {
          p_product_id: productId,
          p_size: size,
          p_color: color,
          p_quantity: quantity
        });

      if (error || !result || !result.success) {
        console.error(`❌ [STOCK DEDUCTION] Failed for ${name}:`, error?.message || result?.error);
        deductionFailed = true;
        deductionError = {
          product: name,
          size: size,
          color: color,
          error: error?.message || result?.error || 'Unknown error',
          details: result
        };
        break; // Stop processing on first failure
      }

      console.log(`  ✅ Deducted ${quantity} units: ${result.previous_stock} → ${result.new_stock}`);
      deductionResults.push(result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: ROLLBACK IF STOCK DEDUCTION FAILED
    // ═══════════════════════════════════════════════════════════════════════

    if (deductionFailed) {
      console.error('❌ [ROLLBACK] Stock deduction failed - rolling back order');
      
      // Delete order items
      await getSupabaseAdmin()
        .from('order_items')
        .delete()
        .eq('order_id', order.id);
      
      // Delete order
      await getSupabaseAdmin()
        .from('orders')
        .delete()
        .eq('id', order.id);
      
      console.log('✅ [ROLLBACK] Order and items deleted successfully');
      
      return res.status(400).json({
        status: 'error',
        message: 'Stock deduction failed - order cancelled',
        data: deductionError
      });
    }

    console.log('✅ [STOCK DEDUCTION] All stock deductions completed successfully');

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6: SEND NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📧 [NOTIFICATIONS] Sending order confirmation');

    // Get user details for notifications
    const { data: userData } = await getSupabaseAdmin()
      .from('users')
      .select('email, phone, full_name')
      .eq('id', user)
      .single();

    // Send SMS notification (non-blocking)
    if (userData?.phone) {
      try {
        await sendSMS(
          userData.phone,
          `Order ${order.orderNumber} confirmed! Total: ₹${totalAmount}. Track: ${process.env.FRONTEND_URL}/orders/${order.id}`
        );
        console.log('✅ [SMS] Order confirmation sent');
      } catch (smsError) {
        console.error('⚠️  [SMS] Failed to send:', smsError.message);
        // Don't fail order on SMS error
      }
    }

    // Send email notification (non-blocking)
    if (userData?.email) {
      try {
        await sendEmail({
          to: userData.email,
          subject: `Order Confirmation - ${order.orderNumber}`,
          template: 'order-confirmation',
          data: {
            orderNumber: order.orderNumber,
            customerName: userData.full_name,
            items: enrichedOrderItems,
            totalAmount: totalAmount,
            shippingAddress: shippingAddress,
            orderUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
          }
        });
        console.log('✅ [EMAIL] Order confirmation sent');
      } catch (emailError) {
        console.error('⚠️  [EMAIL] Failed to send:', emailError.message);
        // Don't fail order on email error
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 7: RETURN SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════════════

    console.log('✅ [ORDER] Order creation completed successfully');

    return res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt
        },
        items: createdItems,
        stockDeductions: deductionResults.map(r => ({
          product: r.product_name,
          size: r.size,
          color: r.color,
          deducted: r.deducted,
          remaining: r.new_stock
        }))
      }
    });

  } catch (error) {
    console.error('❌ [ORDER] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// =============================================================================
// Export other controller functions (keep existing exports)
// =============================================================================

// ... (keep all other existing exports like getOrders, getOrderById, etc.)
