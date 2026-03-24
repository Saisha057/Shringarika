import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
// REMOVED: Email notifications - using SMS only
// import { sendEmail, getOrderEmailTemplate, getDeliveryEmailTemplate, getOrderStatusUpdateEmailTemplate } from '../utils/sendEmail.js';
import { sendOrderStatusUpdateSMS, sendSMS } from '../services/sms.service.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';
import { sendUserNotification } from '../services/notification.service.js';
import { logOrderEvent } from '../services/orderEvent.service.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (or guest with optionalProtect)
export const createOrder = async (req, res, next) => {
  try {
    const { 
      orderItems, 
      shippingAddress, 
      contactDetails, 
      paymentMethod, 
      itemsPrice, 
      taxPrice,
      shippingPrice, 
      discount,
      totalPrice,
      deliveryNotes,
      guestUuid,
      razorpayPaymentId,   // present when order created after Razorpay payment
      razorpayOrderId,     // Razorpay order ID
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No order items',
      });
    }

    // Calculate order totals (NO TAX - product price only)
    const subtotal = itemsPrice || orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryCharge = shippingPrice || 0;
    const discountAmount = discount || 0;
    const finalTotal = totalPrice || (subtotal + deliveryCharge - discountAmount);

    // Extract customer details
    const customerName = shippingAddress?.fullName || contactDetails?.name || req.user?.name || 'Guest Customer';
    const customerEmail = contactDetails?.email || shippingAddress?.email || req.user?.email || '';
    const customerPhone = contactDetails?.phone || shippingAddress?.phone || req.user?.phone || '';

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: VALIDATE STOCK AVAILABILITY (CRITICAL - DO NOT SKIP!)
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('🔍 [STOCK CHECK] Validating stock for all items BEFORE order creation');
    const supabase = getSupabaseAdmin();

    // Map to store the exact inventory row found for each item (used in enrichment + deduction)
    // Key: item.product + '|' + size, Value: { inventoryId, actualColor, stock }
    const inventoryCache = new Map();
    
    for (const item of orderItems) {
      // Resolve size and color — frontend can send them flat (item.size) or nested (item.variant.size)
      let itemSize = item.size || item.variant?.size;
      // Resolve color — treat empty string same as no color; normalize to lowercase for matching
      const rawColor = item.color || item.variant?.color || '';
      const itemColor = rawColor.trim() || null; // null = no specific color (match any)

      if (!itemSize) {
        const { data: prod } = await supabase.from('products').select('sizes').eq('id', item.product).single();
        itemSize = prod?.sizes?.[0] || 'M';
        console.log(`  ⚠️ No size in cart item, using first available: ${itemSize}`);
      }
      
      console.log(`  🔍 Checking: ${item.name} (Size: ${itemSize}, Color: ${itemColor || 'any'}, Qty: ${item.quantity})`);
      
      // Direct query to product_inventory with flexible, case-insensitive color matching
      // FIX: products.colors[] uses lowercase ("red") but inventory.color uses title-case ("Red")
      //      Use .ilike() for case-insensitive match; fall back to no-filter when color is empty
      // NOTE: Use .neq('is_active', false) so that rows with is_active=NULL (newly created via
      //       createProduct which omits the field) are also matched — only explicitly disabled rows
      //       (is_active=false) are excluded.
      let inventoryQuery = supabase
        .from('product_inventory')
        .select('id, stock, color, low_stock_threshold')
        .eq('product_id', item.product)
        .eq('size', itemSize)
        .neq('is_active', false); // match true AND null (newly created rows may have null)

      if (itemColor) {
        // Case-insensitive match to handle "red" vs "Red" vs "RED"
        inventoryQuery = inventoryQuery.ilike('color', itemColor);
      }

      const { data: variantRows, error: stockCheckError } = await inventoryQuery.limit(1);

      if (stockCheckError) {
        console.error(`❌ [STOCK CHECK] Database error for product ${item.product}:`, stockCheckError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to check stock availability',
          error: stockCheckError.message
        });
      }

      let variantRow = variantRows?.[0];

      // FALLBACK: If color-filtered query returned nothing, try again without color filter.
      // This handles inventory rows where color=NULL (default when product is created without
      // per-color variants — a single row covers all colors of that size).
      if (!variantRow && itemColor) {
        console.log(`  ℹ️ [STOCK CHECK] No row matched color="${itemColor}", retrying without color filter (NULL color rows)...`);
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from('product_inventory')
          .select('id, stock, color, low_stock_threshold')
          .eq('product_id', item.product)
          .eq('size', itemSize)
          .neq('is_active', false)
          .limit(1);

        if (!fallbackError && fallbackRows?.length > 0) {
          variantRow = fallbackRows[0];
          console.log(`  ℹ️ [STOCK CHECK] Color-less fallback found row (DB color="${variantRow.color ?? 'NULL'}")`);
        }
      }

      // Cache the found inventory row so enrichment and deduction can use the EXACT DB color value
      // KEY INCLUDES COLOR to correctly handle multi-color variants per size.
      // Without color in the key, two colors of the same (product+size) overwrite each other.
      if (variantRow) {
        const cacheKey = `${item.product}|${itemSize}|${(itemColor || '').toLowerCase()}`;
        inventoryCache.set(cacheKey, {
          inventoryId: variantRow.id,
          actualColor: variantRow.color, // EXACT value stored in DB (used for deduction)
          stock: variantRow.stock
        });
      }

      // Build a consistent stockCheck object
      const stockCheck = variantRow
        ? { exists: true, in_stock: variantRow.stock >= item.quantity, available: variantRow.stock }
        : { exists: false, in_stock: false, available: 0 };

      // Variant doesn't exist
      if (!stockCheck.exists) {
        console.error(`❌ [STOCK CHECK] Variant not found: ${item.name} (${itemSize}/${itemColor || 'any'})`);
        return res.status(400).json({
          status: 'error',
          message: `Product variant not available: ${item.name} (Size: ${itemSize})`,
          data: {
            product: item.name,
            size: itemSize,
            color: itemColor,
            issue: 'Variant not found in inventory'
          }
        });
      }

      // Insufficient stock
      if (!stockCheck.in_stock) {
        console.error(`❌ [STOCK CHECK] Insufficient stock: ${item.name} (Available: ${stockCheck.available}, Requested: ${item.quantity})`);
        return res.status(400).json({
          status: 'error',
          message: `Insufficient stock for ${item.name}`,
          data: {
            product: item.name,
            size: itemSize,
            color: itemColor,
            available: stockCheck.available,
            requested: item.quantity,
            message: `Only ${stockCheck.available} units available, but ${item.quantity} requested`
          }
        });
      }

      console.log(`  ✅ Stock available: ${item.name} (${stockCheck.available} units, DB color: "${variantRow.color}")`);
    }

    console.log('✅ [STOCK CHECK] All items have sufficient stock - proceeding with order');
    console.log('📦 Processing order with', orderItems.length, 'items');

    // Enrich order items with product details
    const enrichedOrderItems = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: `Product not found: ${item.name}`,
        });
      }

      // Resolve size — support both flat (item.size) and nested (item.variant.size)
      const itemSize = item.size || item.variant?.size || product.sizes?.[0] || 'M';

      // Use the EXACT color from the inventory row found during stock check
      // This avoids case mismatches (e.g., "red" from frontend vs "Red" in DB)
      // Derive color the same way as the stock check loop to produce a matching cache key
      const rawEnrichColor = item.color || item.variant?.color || '';
      const enrichColor = rawEnrichColor.trim() || null;
      const cachedVariant = inventoryCache.get(`${item.product}|${itemSize}|${(enrichColor || '').toLowerCase()}`);
      const itemColor = cachedVariant?.actualColor ?? null;
      
      enrichedOrderItems.push({
        productId: item.product,
        productName: item.name || product.name,
        variant: {
          size: itemSize,
          color: itemColor  // EXACT DB value — safe for deduction RPC
        },
        quantity: item.quantity,
        pricePerItem: item.price || product.price,
        lineTotal: (item.price || product.price) * item.quantity,
        image: product.images?.[0] || product.image
      });
    }

    // Calculate estimated delivery date (7 days from now)
    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

    // ✅ FIX: Generate unique order number (CRITICAL - database requires this)
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    console.log('🔢 Generated order number:', orderNumber);

    // Initialize status history
    const statusHistory = [{
      status: 'Pending',
      timestamp: new Date().toISOString(),
      note: 'Order placed successfully'
    }];

    // ✅ Create order in database with complete details (INCLUDING order_number)
    console.log('💾 [ORDER CREATE] Inserting order into database with user_id:', req.user?.id || 'guest');
    let order;
    try {
      order = await Order.create({
        order_number: orderNumber,  // ✅ CRITICAL: This was missing!
        user_id: req.user?.id || null,
        guest_uuid: guestUuid || null,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        order_items: enrichedOrderItems,
        shipping_address: shippingAddress,
        billing_address: shippingAddress,  // Use same as shipping for now
        contact_details: contactDetails || { 
          email: customerEmail, 
          phone: customerPhone 
        },
        payment_method: paymentMethod || 'COD',
        // ONLINE orders are created AFTER Razorpay payment is verified → mark paid immediately
        payment_status: paymentMethod === 'COD' ? 'pending' : 'paid',
        // Store Razorpay IDs in their actual dedicated columns (payment_result column does NOT exist)
        razorpay_payment_id: razorpayPaymentId || null,
        razorpay_order_id: razorpayOrderId || null,
        subtotal: subtotal,
        tax: 0,  // NO TAX
        tax_price: 0,  // NO TAX
        delivery_charge: deliveryCharge,
        shipping_price: deliveryCharge,
        discount: discountAmount,
        items_price: subtotal,
        total_price: finalTotal,
        total_amount: finalTotal,  // Add this for schema compatibility
        currency: '₹',
        order_status: paymentMethod === 'COD' ? 'Pending' : 'Confirmed',
        status_history: statusHistory,
        estimated_delivery_date: estimatedDeliveryDate.toISOString().split('T')[0],
        delivery_notes: deliveryNotes || null,
        is_paid: paymentMethod !== 'COD',
        paid_at: paymentMethod !== 'COD' ? new Date().toISOString() : null,
        is_delivered: false
      });
    } catch (dbError) {
      console.error('❌ [ORDER CREATE] Database insert failed:', dbError);
      console.error('❌ [ORDER CREATE] Error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint
      });
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create order in database',
        error: dbError.message
      });
    }

    if (!order || !order.id) {
      console.error('❌ [ORDER CREATE] Order created but no ID returned');
      return res.status(500).json({
        status: 'error',
        message: 'Order creation failed: no order ID returned'
      });
    }

    console.log('✅ [ORDER CREATE] Order inserted successfully:', order.id, 'Order Number:', order.order_number);

    setImmediate(async () => {
      try {

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: DEDUCT STOCK ATOMICALLY (CRITICAL - TRANSACTION-SAFE)
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📉 [STOCK DEDUCTION] Starting atomic stock deduction for all items');

    let deductionFailed = false;
    let deductionError = null;

    for (const item of enrichedOrderItems) {
      const { productId, variant, quantity, productName } = item;
      
      console.log(`  🔒 Deducting ${quantity} units: ${productName} (${variant.size}/${variant.color ?? 'none'})`);
      
      // Use the exact color value from the inventory row found during stock check.
      // variant.color is already the EXACT DB value (Title-case like "Red") — safe for RPC matching.
      // Pass null if no color, so COALESCE(null,'default') matches NULL rows in DB.
      const deductColor = variant.color || null;
      const { data: result, error } = await supabase
        .rpc('deduct_stock_atomic', {
          p_product_id: productId,
          p_size: variant.size,
          p_color: deductColor,
          p_quantity: quantity
        });

      if (error || !result || !result.success) {
        const errMsg = error?.message || result?.error || 'Unknown error';
        console.error(`❌ [STOCK DEDUCTION] Failed for ${productName}:`, errMsg);

        // ── RECOVERY: Inventory entry missing → create it and retry ─────────
        // This happens when a product was created before inventory seeding was
        // in place.  We auto-create the row and try one more time.
        if (errMsg.includes('Variant not found') || errMsg.includes('not found')) {
          console.warn(`⚠️  [STOCK] No inventory row for "${productName}" (${variant.size}). Auto-creating...`);
          try {
            const invColor = (variant.color && variant.color !== 'default') ? variant.color : null;
            await supabase.from('product_inventory').upsert({
              product_id: productId,
              size: variant.size,
              color: invColor,
              stock: 999,        // Start with a generous default
              is_active: true,
              low_stock_threshold: 5,
              reserved_quantity: 0,
              reserved_stock: 0
            }, { onConflict: 'product_id,size' });

            // Retry deduction
            const { data: retryResult, error: retryError } = await supabase
              .rpc('deduct_stock_atomic', {
                p_product_id: productId,
                p_size: variant.size,
                p_color: null,  // null → COALESCE gives 'default' → matches newly created NULL row
                p_quantity: quantity
              });

            if (retryError || !retryResult || !retryResult.success) {
              console.error(`❌ [STOCK DEDUCTION] Retry also failed for ${productName}:`, retryError?.message || retryResult?.error);
              // Still don't hard-fail the order for a stock bookkeeping issue
              console.warn(`⚠️  [STOCK] Proceeding with order despite stock deduction failure for ${productName}`);
            } else {
              console.log(`  ✅ (retry) Deducted ${quantity} units: ${retryResult.previous_stock} → ${retryResult.new_stock}`);
            }
          } catch (inventoryCreateErr) {
            console.error('❌ [STOCK] Failed to auto-create inventory entry:', inventoryCreateErr.message);
            // Don't cancel the order – stock bookkeeping can be reconciled manually
            console.warn(`⚠️  [STOCK] Proceeding with order without stock deduction for ${productName}`);
          }
          // Continue to the next item — do NOT set deductionFailed
          continue;
        }

        // ── HARD FAILURE: Insufficient stock → cancel order ──────────────────
        deductionFailed = true;
        deductionError = {
          product: productName,
          size: variant.size,
          color: variant.color,
          error: errMsg,
          details: result
        };
        break; // Stop processing on first failure
      }

      console.log(`  ✅ Deducted ${quantity} units: ${result.previous_stock} → ${result.new_stock}`);
      
      // Low stock warning
      if (result.new_stock > 0 && result.new_stock <= 5) {
        console.log(`  ⚠️  LOW STOCK ALERT: ${result.new_stock} units remaining`);
        // 🔔 Emit LOW_STOCK event for admin notification (non-blocking, absorbed errors)
        try {
          eventBus.emit(EVENTS.LOW_STOCK, { product: { name: item.productName, id: item.productId }, remainingStock: result.new_stock });
        } catch (ebErr) { /* non-fatal */ }
      } else if (result.new_stock === 0) {
        console.log(`  🚫 OUT OF STOCK: Product now unavailable`);
        // 🔔 Emit LOW_STOCK event (0 stock)
        try {
          eventBus.emit(EVENTS.LOW_STOCK, { product: { name: item.productName, id: item.productId }, remainingStock: 0 });
        } catch (ebErr) { /* non-fatal */ }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: ROLLBACK IF STOCK DEDUCTION FAILED
    // ═══════════════════════════════════════════════════════════════════════

    if (deductionFailed) {
      console.error('❌ [ROLLBACK] Stock deduction failed - rolling back order');
      
      // Delete order from database
      try {
        await supabase
          .from('orders')
          .delete()
          .eq('id', order.id);
        
        console.log('✅ [ROLLBACK] Order deleted successfully');
      } catch (rollbackError) {
        console.error('❌ [ROLLBACK] Failed to delete order:', rollbackError);
      }

      console.error('⚠️ [ROLLBACK] Post-response rollback completed due to deduction failure:', deductionError);
      return;
    }

    console.log('✅ [STOCK DEDUCTION] All stock deductions completed successfully');

    // Stock management simplified - will be handled separately
    console.log('📦 [STOCK] Stock management will be updated separately');

    // Defensive check: ensure the created order has an `id` before responding.
    // If `id` is missing, log the full order for debugging and attach a safe fallback
    // identifier to the response (prefer `order_number`, otherwise generate a UUID).
    if (!order || !order.id) {
      console.error('⚠️ Order created but missing `id` field. Full order object:', order);

      // If order object wasn't returned at all, treat as server error
      if (!order) {
        console.error('❌ [POST-ORDER] Missing order payload after successful response');
        return;
      }

      // Determine fallback id: prefer order_number, otherwise generate a UUID
      let fallbackId = order.order_number || null;
      if (!fallbackId) {
        try {
          const { randomUUID } = await import('crypto');
          fallbackId = randomUUID();
        } catch (uuidErr) {
          fallbackId = 'order-' + Date.now();
        }
      }

      // Attach fallback id for response only (do not alter DB here)
      try {
        order.id = fallbackId;
        order.orderId = fallbackId;
      } catch (mutErr) {
        console.error('Failed to attach fallback id to order object:', mutErr);
      }

      console.warn('Applied fallback id for order response:', fallbackId);
    }

    console.log('✅ Order created successfully:', order.order_number || order.id);

    await logOrderEvent({
      orderId: order.id,
      userId: req.user?.id || null,
      type: 'ORDER_PLACED',
      description: `Order ${order.id} placed successfully`,
    });

    await sendUserNotification({
      email: customerEmail,
      subject: 'Order Confirmed',
      message: `Your order ${order.id} has been placed successfully. We will notify you when it ships.`,
    });

    // 🔔 Emit ORDER_CREATED event (admin notification + future channels, non-blocking)
    try {
      eventBus.emit(EVENTS.ORDER_CREATED, { order, paymentMethod: paymentMethod || 'COD' });
    } catch (ebErr) {
      console.error('⚠️ [EventBus] emit ORDER_CREATED failed (non-fatal):', ebErr.message);
    }
    
    // ✅ REMOVED EMAIL - SMS ONLY: Send order confirmation SMS
    if (customerPhone) {
      try {
        await sendSMS(
          customerPhone,
          `Thank you ${customerName}! Your order #${order.order_number || order.id} has been confirmed. Total: ₹${finalTotal}. Track your order: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders - Shringarika`
        );
        console.log('✅ Order confirmation SMS sent to:', customerPhone);
      } catch (smsError) {
        console.error('⚠️ Failed to send order confirmation SMS:', smsError.message);
        // SMS failure does NOT affect order success
      }
    } else {
      console.warn('⚠️ No customer phone provided - skipping confirmation SMS');
    }

      } catch (postOrderError) {
        console.error('❌ [POST-ORDER] Background processing failed:', postOrderError?.message || postOrderError);
      }

    });

    // Respond immediately so checkout does not timeout while post-order tasks run.
    return res.status(201).json({
      status: 'success',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
      },
    });
  } catch (error) {
    console.error('Order creation error:', error);
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let order;

    // Check if id is UUID format or order_number
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(id)) {
      // Search by UUID
      order = await Order.findById(id);
    } else {
      // Search by order_number
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', id)
        .single();
      
      if (error || !data) {
        return res.status(404).json({
          status: 'error',
          message: 'Order not found',
        });
      }
      
      order = data;
    }

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Make sure user owns this order or is admin
    if (req.user && order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this order',
      });
    }

    // Add orderStatus field for frontend
    const orderWithStatus = {
      ...order,
      orderStatus: order.order_status // Make sure this is available for frontend
    };

    res.status(200).json({
      status: 'success',
      data: { order: orderWithStatus },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
export const updateOrderToPaid = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    const updatedOrder = await Order.update(req.params.id, {
      is_paid: true,
      paid_at: new Date().toISOString(),
      payment_status: 'paid',
      // Store in actual DB columns (payment_result does NOT exist in schema)
      razorpay_payment_id: req.body.razorpay_payment_id || null,
      razorpay_order_id: req.body.razorpay_order_id || null,
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, note, trackingNumber, estimatedDeliveryDate } = req.body;

    // VALIDATION: Check if status is valid
    const VALID_STATUSES = [
      'Pending',
      'Confirmed',
      'Processing',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Returned',
      'Refunded'
    ];

    if (!orderStatus || !VALID_STATUSES.includes(orderStatus)) {
      console.error('❌ [INVALID STATUS] Received:', orderStatus);
      console.error('❌ [INVALID STATUS] Valid statuses:', VALID_STATUSES.join(', '));
      return res.status(400).json({
        status: 'error',
        message: `Invalid order status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        validStatuses: VALID_STATUSES
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Store previous status for email notification
    const previousStatus = order.order_status || order.status;

    // Parse existing status history
    const statusHistory = order.status_history || [];
    statusHistory.push({
      status: orderStatus,
      previousStatus: previousStatus,
      note: note || '',
      timestamp: new Date().toISOString(),
      updatedBy: req.user?.email || 'admin'
    });

    const updates = {
      order_status: orderStatus,
      status: orderStatus, // Also update 'status' column if it exists for compatibility
      status_history: statusHistory,
      status_updated_at: new Date().toISOString()
    };

    if (trackingNumber) {
      updates.tracking_number = trackingNumber;
    }

    if (estimatedDeliveryDate) {
      updates.estimated_delivery_date = estimatedDeliveryDate;
    }

    if (orderStatus === 'Delivered') {
      updates.is_delivered = true;
      updates.delivered_at = new Date().toISOString();
    }

    console.log('📝 [UPDATE ORDER STATUS] Order ID:', req.params.id);
    console.log('📝 [UPDATE ORDER STATUS] Previous Status:', previousStatus);
    console.log('📝 [UPDATE ORDER STATUS] New Status:', orderStatus);
    console.log('📝 [UPDATE ORDER STATUS] Updates:', updates);

    const updatedOrder = await Order.update(req.params.id, updates);

    console.log('✅ [UPDATE ORDER STATUS] Order updated successfully');
    console.log('✅ [UPDATE ORDER STATUS] Updated status:', updatedOrder.order_status || updatedOrder.status);

    // REMOVED EMAIL NOTIFICATIONS - SMS ONLY
    // Send SMS notification for ALL status updates
    if (updatedOrder.customer_phone) {
      try {
        console.log('📱 Sending SMS notification for status update...');
        await sendOrderStatusUpdateSMS(
          updatedOrder,
          { phone: updatedOrder.customer_phone, name: updatedOrder.customer_name },
          orderStatus,
          trackingNumber
        );
        console.log('✅ Order status SMS sent to:', updatedOrder.customer_phone);
      } catch (smsError) {
        console.error('⚠️ Failed to send order status SMS:', smsError.message);
        // Don't fail the request if SMS fails
      }
    } else {
      console.warn('⚠️ No customer phone number - skipping SMS notification');
    }

    const timelineEmail = updatedOrder.customer_email || order.customer_email;
    const timelineUserId = updatedOrder.user_id || order.user_id || null;

    if (orderStatus === 'Shipped') {
      await logOrderEvent({
        orderId: req.params.id,
        userId: timelineUserId,
        type: 'SHIPPED',
        description: `Order ${req.params.id} has been shipped`,
      });

      await sendUserNotification({
        email: timelineEmail,
        subject: 'Order Shipped',
        message: `Your order ${req.params.id} has been shipped and is on its way.`,
      });
    }

    if (orderStatus === 'Delivered') {
      await logOrderEvent({
        orderId: req.params.id,
        userId: timelineUserId,
        type: 'DELIVERED',
        description: `Order ${req.params.id} delivered`,
      });

      await sendUserNotification({
        email: timelineEmail,
        subject: 'Order Delivered',
        message: `Your order ${req.params.id} has been delivered. Thank you for shopping with us.`,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update only tracking number and carrier for an order
// @route   PATCH /api/orders/:id/tracking
// @access  Private/Admin
export const updateTracking = async (req, res, next) => {
  try {
    const { trackingNumber, carrier } = req.body;

    if (!trackingNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'trackingNumber is required',
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    const updates = {
      tracking_number: trackingNumber,
    };
    if (carrier) {
      updates.courier_service = carrier;
    }

    const updatedOrder = await Order.update(req.params.id, updates);

    console.log(`✅ [UPDATE TRACKING] Order ${req.params.id} tracking updated: ${trackingNumber}`);

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res, next) => {
  try {
    console.log('📦 [GET MY ORDERS] User ID:', req.user?.id);
    console.log('📦 [GET MY ORDERS] User Email:', req.user?.email);
    
    const orders = await Order.findByUserId(req.user.id);
    
    console.log('📦 [GET MY ORDERS] Found', orders?.length || 0, 'orders');

    // Add orderStatus and format order_items with product details
    const ordersWithDetails = orders.map(order => {
      // Format order_items to include product name, image, and variant details
      const formattedItems = (order.order_items || []).map(item => {
        // Parse variant_info JSONB — stored during order creation with {size, color}.
        // variant_id is NULL for orders placed via product_inventory (not product_variants),
        // so the product_variants join returns null. variant_info is the only source of size/color.
        const variantInfo = item.variant_info
          ? (typeof item.variant_info === 'string' ? JSON.parse(item.variant_info) : item.variant_info)
          : {};

        return {
          id: item.id,
          productId: item.product_id,
          productName: item.product_name || item.products?.name || 'Product',
          name: item.product_name || item.products?.name || 'Product', // Add both formats
          image: item.image || item.image_url || (item.products?.images && item.products.images.length > 0 
            ? item.products.images[0] 
            : null),
          image_url: item.image || item.image_url || null,  // ✅ Include image from JSONB order_items
          quantity: item.quantity,
          pricePerItem: item.unit_price,
          price: item.unit_price, // Add both formats
          size: item.product_variants?.size || variantInfo.size || null,
          color: item.product_variants?.color || variantInfo.color || null,
          variant: item.product_variants
            ? { id: item.variant_id, size: item.product_variants.size, color: item.product_variants.color }
            : (variantInfo.size || variantInfo.color
                ? { size: variantInfo.size || null, color: variantInfo.color || null }
                : null)
        };
      });

      // Prioritize order_status (primary DB field) over status
      const normalizedStatus = order.order_status || order.status || 'pending';
      
      console.log(`📦 [ORDER ${order.id}] DB order_status: ${order.order_status}, status: ${order.status}, normalized: ${normalizedStatus}`);

      return {
        id: order.id,
        orderId: order.id,
        orderNumber: order.order_number,
        order_number: order.order_number,
        order_status: normalizedStatus,
        payment_status: order.payment_status,
        is_paid: order.is_paid,
        is_delivered: order.is_delivered,
        total_price: order.total_price,
        subtotal: order.subtotal,
        delivery_charge: order.delivery_charge,
        created_at: order.created_at,
        updated_at: order.updated_at,
        shipping_address: order.shipping_address,
        estimated_delivery_date: order.estimated_delivery_date,
        tracking_number: order.tracking_number,
        courier_service: order.courier_service,
        delivery_notes: order.delivery_notes,
        return_requested: order.return_requested || false,
        return_status: order.return_status || null,
        exchange_requested: order.exchange_requested || false,
        exchange_status: order.exchange_status || null,
        order_items: formattedItems,
        orderItems: formattedItems // Add both formats
      };
    });

    console.log('✅ [GET MY ORDERS] Returning', ordersWithDetails.length, 'formatted orders');

    res.status(200).json({
      status: 'success',
      data: { orders: ordersWithDetails },
    });
  } catch (error) {
    console.error('❌ [GET MY ORDERS] Error:', error);
    next(error);
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll();

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          page: 1,
          limit: orders.length,
          total: orders.length,
          pages: 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Check if user owns this order
    if (req.user && order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to cancel this order',
      });
    }

    // Check if order can be cancelled
    if (['Shipped', 'Delivered', 'Cancelled'].includes(order.order_status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot cancel order with status: ${order.order_status}`,
      });
    }

    // Restore stock in product_inventory (same table that was deducted during order creation)
    // NOTE: Order.findById does NOT join order_items, so we fetch them separately.
    const supabase = getSupabaseAdmin();
    const { data: orderItemsRows } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    const orderItems = orderItemsRows || [];
    for (const item of orderItems) {
      try {
        const variantInfo = item.variant_info
          ? (typeof item.variant_info === 'string' ? JSON.parse(item.variant_info) : item.variant_info)
          : {};
        const size = variantInfo.size || null;
        const color = variantInfo.color || null;
        const productId = item.product_id;
        const qty = item.quantity;
        if (!productId || !size) {
          console.warn(`⚠️ [CANCEL] Cannot restore stock — missing productId or size for item ${item.id}`);
          continue;
        }
        let restoreQuery = supabase
          .from('product_inventory')
          .select('id, stock')
          .eq('product_id', productId)
          .eq('size', size)
          .eq('is_active', true);
        if (color) {
          restoreQuery = restoreQuery.ilike('color', color);
        }
        const { data: invRows } = await restoreQuery.limit(1);
        const invRow = invRows?.[0];
        if (invRow) {
          await supabase
            .from('product_inventory')
            .update({ stock: invRow.stock + qty })
            .eq('id', invRow.id);
          console.log(`✅ [CANCEL] Restored ${qty} units for product ${productId} (${size}/${color || 'any'}) → new stock: ${invRow.stock + qty}`);
        } else {
          console.warn(`⚠️ [CANCEL] No inventory row found for product ${productId} (${size}/${color || 'any'}) — skipping restore`);
        }
      } catch (restoreErr) {
        console.error('⚠️ [CANCEL] Stock restore error (non-fatal):', restoreErr.message);
      }
    }

    const statusHistory = order.status_history || [];
    statusHistory.push({
      status: 'Cancelled',
      note: req.body.reason || 'Cancelled by user',
      timestamp: new Date().toISOString()
    });

    const updatedOrder = await Order.update(req.params.id, {
      order_status: 'Cancelled',
      status_history: statusHistory
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
    });
  } catch (error) {
    next(error);
  }
};