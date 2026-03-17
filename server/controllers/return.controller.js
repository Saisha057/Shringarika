import Order from '../models/Order.model.js';
import { supabaseAdmin } from '../config/supabase.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';
// REMOVED: Email notifications - using SMS only
// import { sendEmail, getReturnEmailTemplate, getExchangeEmailTemplate, getRefundEmailTemplate } from '../utils/sendEmail.js';
import { sendSMS } from '../services/sms.service.js';
import { sendAdminNotification, sendUserNotification } from '../services/notification.service.js';
import { logOrderEvent } from '../services/orderEvent.service.js';
import { createAdminNotification } from '../services/adminNotification.service.js';

// @desc    Request order return
// @route   POST /api/orders/:id/return
// @access  Private
export const requestReturn = async (req, res, next) => {
  try {
    const {
      reasons,
      otherReason,
      refundMethod,
      refundDetails,
      itemsToReturn,
      pickupScheduledDate,
      pickupTimeSlot,
      productConditionPhotos,
      customerConfirmation,
      priorityFlag,
      disputeFlag,
    } = req.body;
    const orderId = req.params.id;

    // Validate input
    if (!reasons || reasons.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please select at least one return reason'
      });
    }

    if (!refundMethod) {
      return res.status(400).json({
        status: 'error',
        message: 'Please select a refund method'
      });
    }

    if (!itemsToReturn || !Array.isArray(itemsToReturn) || itemsToReturn.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one item must be selected for return'
      });
    }

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    // Verify ownership
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to return this order'
      });
    }

    // Check if order is delivered
    if (order.order_status !== 'Delivered') {
      return res.status(400).json({
        status: 'error',
        message: 'Only delivered orders can be returned'
      });
    }

    // Check if already returned or return requested
    if (order.order_status === 'Returned' || order.return_status) {
      return res.status(400).json({
        status: 'error',
        message: 'Return already requested for this order'
      });
    }

    // Create return request data
    const returnRequest = {
      reasons: reasons,
      otherReason: otherReason || null,
      refundMethod: refundMethod,
      refundDetails: refundDetails || {},
      requestedAt: new Date().toISOString(),
      requestedBy: req.user.id
    };

    // Fetch order items from order_items table (Order.findById only returns orders.*)
    const { data: orderItemsRows, error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .select('id, product_id, product_name, variant_id, quantity, unit_price')
      .eq('order_id', orderId);

    if (orderItemsError) {
      console.error('❌ Error fetching order_items for return:', orderItemsError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch order items for return request'
      });
    }

    if (!orderItemsRows || orderItemsRows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No order items found for this order'
      });
    }

    // ✅ CREATE ENTRY IN returns TABLE (so it shows in admin dashboard)
    const orderItemsById = new Map(orderItemsRows.map((item) => [String(item.id), item]));
    const orderItemsByProduct = new Map(orderItemsRows.map((item) => [String(item.product_id), item]));

    const returnItems = itemsToReturn
      .map((selectedItem) => {
        const selectedOrderItemId = selectedItem?.order_item_id ? String(selectedItem.order_item_id) : null;
        const selectedProductId = selectedItem?.product_id ? String(selectedItem.product_id) : null;
        const matchedOrderItem =
          (selectedOrderItemId && orderItemsById.get(selectedOrderItemId)) ||
          (selectedProductId && orderItemsByProduct.get(selectedProductId));

        if (!matchedOrderItem) return null;

        const itemQty = Number(selectedItem?.quantity || matchedOrderItem.quantity || 1);
        const itemPrice = Number(selectedItem?.price ?? matchedOrderItem.unit_price ?? 0);

        return {
          order_item_id: matchedOrderItem.id,
          product_id: matchedOrderItem.product_id,
          product_name: selectedItem?.product_name || matchedOrderItem.product_name,
          variant_id: matchedOrderItem.variant_id || null,
          quantity: Number.isFinite(itemQty) && itemQty > 0 ? itemQty : 1,
          price: Number.isFinite(itemPrice) && itemPrice >= 0 ? itemPrice : 0,
          reason: reasons.join(', ')
        };
      })
      .filter(Boolean);

    if (returnItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Selected return items do not match this order'
      });
    }

    const refundAmount = returnItems.reduce((sum, item) => {
      return sum + (Number(item.price || 0) * Number(item.quantity || 1));
    }, 0);

    console.log('[ReturnCreate] Items to return:', returnItems.length);
    console.log('[ReturnCreate] Calculated refund amount:', refundAmount);
    console.log('[ReturnCreate] Item breakdown:', returnItems.map(i => `${i.product_name}: Rs.${i.price} x ${i.quantity}`));

    const baseInsertPayload = {
      order_id: orderId,
      user_id: req.user.id,
      return_type: 'refund',
      reason: reasons.join(', '),
      reason_details: otherReason || null,
      return_items: returnItems,
      refund_amount: refundAmount,
      refund_method: refundMethod,
      status: 'requested',
      refund_status: 'pending',
      pickup_address: order.shipping_address
    };

    const enterpriseInsertPayload = {
      pickup_scheduled_date: pickupScheduledDate || null,
      pickup_time_slot: pickupTimeSlot || null,
      inspection_photos: Array.isArray(productConditionPhotos) ? productConditionPhotos : [],
      customer_confirmation: Boolean(customerConfirmation),
      priority_flag: Boolean(priorityFlag || disputeFlag),
      sla_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    let createdReturn = null;
    let returnError = null;

    ({ data: createdReturn, error: returnError } = await supabaseAdmin
      .from('returns')
      .insert([{ ...baseInsertPayload, ...enterpriseInsertPayload }])
      .select()
      .single());

    if (returnError && /column/i.test(returnError.message || '')) {
      console.warn('[ReturnCreate] Enterprise columns missing. Retrying with base payload only.');
      ({ data: createdReturn, error: returnError } = await supabaseAdmin
        .from('returns')
        .insert([baseInsertPayload])
        .select()
        .single());
    }

    if (returnError) {
      console.error('❌ Error creating return entry:', returnError);
      return res.status(500).json({
        status: 'error',
        message: 'Return creation failed'
      });
    } else {
      console.log('✅ Created return entry in returns table:', createdReturn.id);
    }

    const userName = req.user?.name || order.customer_name || 'Customer';
    const userEmail = req.user?.email || order.customer_email || '';
    const firstReturnItem = returnItems[0] || {};
    const reasonText = reasons.join(', ');
    const variantInfo = firstReturnItem.variant_id || 'N/A';

    await logOrderEvent({
      orderId: order.id || orderId,
      userId: req.user?.id || null,
      type: 'RETURN_REQUESTED',
      description: `Return requested for order ${order.id || orderId}`,
    });

    try {
      console.log('[Email] sendAdminNotification called for type:', 'Return');
      console.log('Sending admin notification email...');
      await sendAdminNotification({
        type: 'Return',
        order: { id: order.id || orderId },
        product: { name: firstReturnItem.product_name || 'N/A', variant: variantInfo },
        user: { name: userName, email: userEmail || 'N/A' },
        reason: reasonText,
      });
      console.log('[Email] Admin email sent successfully');
      console.log('Admin email sent successfully');
    } catch (emailError) {
      console.error('Admin email failed (non-blocking):', emailError.message);
    }

    try {
      const createdNotification = await createAdminNotification({
        type: 'RETURN_REQUESTED',
        message: `New return request for order ${order.id || orderId} by ${userName || 'a user'}`,
        referenceId: createdReturn.id,
      });

      if (!createdNotification) {
        const notificationInsert = {
          type: 'RETURN_REQUESTED',
          message: `New return request from ${userName || userEmail || 'a customer'} for order ${order.id || orderId}. Product: ${firstReturnItem.product_name || 'N/A'}. Amount: Rs.${createdReturn.refund_amount || order.total_price || 0}.`,
          is_read: false,
          reference_id: createdReturn.id,
          created_at: new Date().toISOString(),
        };

        console.log('[ReturnController] Inserting notification:', notificationInsert);

        const { data: notifData, error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notificationInsert)
          .select()
          .single();

        if (notifError) {
          console.error('[ReturnController] Notification insert FAILED:', notifError.message, notifError.details, notifError.hint, 'Code:', notifError.code);
        } else {
          console.log('[ReturnController] Notification inserted successfully. ID:', notifData?.id);
        }
      } else {
        console.log('Admin notification created for return:', createdReturn.id);
      }
    } catch (notifError) {
      console.error('[ReturnController] Notification try/catch error:', notifError.message);
    }

    try {
      await sendUserNotification({
        email: userEmail,
        subject: 'Return Request Submitted',
        message: `Your return request for order ${order.id || orderId} has been submitted and is under review.`,
      });
    } catch (userEmailError) {
      console.error('User email failed (non-blocking):', userEmailError.message);
    }

    // Update order with return request
    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        return_requested: true,
        return_status: 'requested',
        return_request: returnRequest,
        has_return: true,
        return_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order with return request:', error);
      throw error;
    }

    // REMOVED EMAIL - SMS ONLY: Send return request SMS notification
    if (order.customer_phone) {
      try {
        await sendSMS(
          order.customer_phone,
          `Your return request for order #${order.order_number} has been received and is under review. We will notify you once it's processed. Refund will be processed to your ${refundMethod || 'account'}. - Shringarika`
        );
        console.log('✅ Return request SMS sent to:', order.customer_phone);
      } catch (smsError) {
        console.error('⚠️ Failed to send return request SMS:', smsError);
      }
    } else {
      console.warn('⚠️ No customer phone number - skipping SMS notification');
    }

    res.status(200).json({
      status: 'success',
      message: 'Return request submitted successfully',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Return request error:', error);
    next(error);
  }
};

// @desc    Request order exchange
// @route   POST /api/orders/:id/exchange
// @access  Private
export const requestExchange = async (req, res, next) => {
  try {
    const { itemId, newSize, newColor, reason } = req.body;
    const orderId = req.params.id;

    // Validate input
    if (!itemId) {
      return res.status(400).json({
        status: 'error',
        message: 'Please select an item to exchange'
      });
    }

    if (!newSize && !newColor) {
      return res.status(400).json({
        status: 'error',
        message: 'Please select new size or color'
      });
    }

    // Fetch order (base row only)
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    // Verify ownership
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to exchange this order'
      });
    }

    // Check if order is delivered
    if (order.order_status !== 'Delivered') {
      return res.status(400).json({
        status: 'error',
        message: 'Only delivered orders can be exchanged'
      });
    }

    // Check if exchange already requested
    if (order.exchange_requested || order.exchange_status) {
      return res.status(400).json({
        status: 'error',
        message: 'Exchange already requested for this order'
      });
    }

    // Check exchange window (30 days from delivery date)
    if (order.delivered_at) {
      const EXCHANGE_WINDOW_DAYS = 30;
      const windowExpiry = new Date(
        new Date(order.delivered_at).getTime() + EXCHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      if (new Date() > windowExpiry) {
        return res.status(400).json({
          status: 'error',
          message: `Exchange window has expired. Exchanges must be requested within ${EXCHANGE_WINDOW_DAYS} days of delivery.`
        });
      }
    }

    // Fetch the exact order_items row by id + order_id (frontend sends order_items.id)
    const { data: orderItem, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('id, order_id, product_id, product_name, variant_id, quantity, unit_price, variant_info')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .single();

    if (itemsError || !orderItem) {
      console.error('❌ Item lookup failed for exchange:', itemsError);
      return res.status(404).json({
        status: 'error',
        message: 'Item not found in order. Please select a valid item from your order.'
      });
    }

    let variantInfo = {};
    try {
      variantInfo = typeof orderItem.variant_info === 'string'
        ? JSON.parse(orderItem.variant_info)
        : orderItem.variant_info || {};
    } catch (e) {
      variantInfo = {};
    }
    const variantSize = variantInfo.size || null;
    const variantColor = variantInfo.color || null;

    // Create exchange request data
    const exchangeRequest = {
      itemId: itemId,
      productName: orderItem.product_name,
      originalSize: variantSize,
      originalColor: variantColor,
      newSize: newSize || variantSize,
      newColor: newColor || variantColor,
      reason: reason || 'Size/color exchange',
      requestedAt: new Date().toISOString(),
      requestedBy: req.user.id
    };

    // ── FIX: Insert exchange into returns table so admin can see it ──
    const { data: createdReturn, error: returnInsertError } = await supabaseAdmin
      .from('returns')
      .insert([{
        order_id: orderId,
        user_id: req.user.id,
        return_type: 'exchange',
        reason: reason || 'Size/color exchange',
        reason_details: `New size: ${newSize || 'same'}, New color: ${newColor || 'same'}`,
        return_items: [{
          order_item_id: orderItem.id,
          product_id: orderItem.product_id,
          product_name: orderItem.product_name,
          variant_id: orderItem.variant_id || null,
          quantity: orderItem.quantity,
          price: orderItem.unit_price,
          original_size: variantSize,
          original_color: variantColor,
          new_size: newSize || null,
          new_color: newColor || null,
          reason: reason || 'Size/color exchange'
        }],
        exchange_product_id: orderItem.product_id,
        exchange_variant: { newSize: newSize || null, newColor: newColor || null },
        refund_amount: 0,
        pickup_address: order.shipping_address,
        status: 'requested'
      }])
      .select()
      .single();

    if (returnInsertError) {
      console.error('❌ Error inserting exchange into returns table:', returnInsertError);
      return res.status(500).json({
        status: 'error',
        message: 'Exchange creation failed'
      });
    } else {
      console.log('✅ Exchange request saved to returns table:', createdReturn.id);
    }

    const exchangeUserName = req.user?.name || order.customer_name || 'Customer';
    const exchangeUserEmail = req.user?.email || order.customer_email || '';
    const exchangeVariantInfo = `${variantSize || 'N/A'} / ${variantColor || 'N/A'} -> ${newSize || variantSize || 'N/A'} / ${newColor || variantColor || 'N/A'}`;

    await logOrderEvent({
      orderId: order.id || orderId,
      userId: req.user?.id || null,
      type: 'EXCHANGE_REQUESTED',
      description: `Exchange requested for order ${order.id || orderId}`,
    });

    try {
      console.log('[Email] sendAdminNotification called for type:', 'Exchange');
      console.log('Sending admin notification email...');
      await sendAdminNotification({
        type: 'Exchange',
        order: { id: order.id || orderId },
        product: { name: orderItem.product_name || 'N/A', variant: exchangeVariantInfo },
        user: { name: exchangeUserName, email: exchangeUserEmail || 'N/A' },
        reason: reason || 'Size/color exchange',
      });
      console.log('[Email] Admin email sent successfully');
      console.log('Admin email sent successfully');
    } catch (emailError) {
      console.error('Exchange admin email failed (non-blocking):', emailError.message);
    }

    try {
      const createdNotification = await createAdminNotification({
        type: 'EXCHANGE_REQUESTED',
        message: `New exchange request for order ${order.id || orderId} by ${exchangeUserName || 'a user'}`,
        referenceId: createdReturn.id,
      });

      if (!createdNotification) {
        const notificationInsert = {
          type: 'EXCHANGE_REQUESTED',
          message: `New exchange request from ${exchangeUserName || exchangeUserEmail || 'a customer'} for order ${order.id || orderId}. Amount: Rs.${createdReturn.refund_amount || 0}.`,
          is_read: false,
          reference_id: createdReturn.id,
          created_at: new Date().toISOString(),
        };

        const { data: notifData, error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notificationInsert)
          .select()
          .single();

        if (notifError) {
          console.error('[ExchangeController] Notification insert failed:', notifError.message);
        } else {
          console.log('[ExchangeController] Notification inserted:', notifData?.id);
        }
      } else {
        console.log('[Exchange] Notification insert called');
        console.log('Admin notification created for exchange:', createdReturn.id);
      }
    } catch (notifError) {
      console.error('[ExchangeController] Notification error (non-blocking):', notifError.message);
    }

    try {
      await sendUserNotification({
        email: exchangeUserEmail,
        subject: 'Exchange Request Submitted',
        message: `Your exchange request for order ${order.id || orderId} has been submitted and is under review.`,
      });
    } catch (userEmailError) {
      console.error('Exchange user email failed (non-blocking):', userEmailError.message);
    }

    // Update order to mark exchange requested
    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        exchange_requested: true,
        exchange_status: 'requested',
        exchange_request: exchangeRequest,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order with exchange request:', error);
      throw error;
    }

    // Send SMS notification to customer
    if (order.customer_phone) {
      try {
        const itemDetails = `${orderItem.product_name}${variantSize ? ` (Size: ${variantSize})` : ''}${variantColor ? ` (Color: ${variantColor})` : ''}`;
        const newDetails = `${newSize ? `Size: ${newSize}` : ''}${newSize && newColor ? ', ' : ''}${newColor ? `Color: ${newColor}` : ''}`;

        await sendSMS(
          order.customer_phone,
          `Your exchange request for ${itemDetails} from order #${order.order_number} has been received. New variant: ${newDetails}. We'll check stock availability and contact you soon. - Shringarika`
        );
        console.log('✅ Exchange request SMS sent to:', order.customer_phone);
      } catch (smsError) {
        console.error('⚠️ Failed to send exchange request SMS:', smsError);
      }
    } else {
      console.warn('⚠️ No customer phone number - skipping SMS notification');
    }

    res.status(200).json({
      status: 'success',
      message: 'Exchange request submitted successfully',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Exchange request error:', error);
    next(error);
  }
};

// @desc    Approve return request (Admin only)
// @route   PUT /api/orders/:id/return/approve
// @access  Private/Admin
export const approveReturn = async (req, res, next) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    console.log('[Route] PUT /:orderId/return/approve hit. orderId:', orderId);
    const {
      adminNotes,
      refundMethod,
      refundAmount,
      notes,
      refundNotes,
      refundPaymentMode,
      refundBankName,
      refundAccountNumber,
      refundIfscCode,
      refundUpiId,
      selectedUpiApp,
      refundTransactionId,
      refundTransactionDate
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    console.log('[ReturnApprove] Looking up return for orderId:', orderId);

    // First try by order_id
    let { data: returnRecord, error: findError } = await supabaseAdmin
      .from('returns')
      .select('*')
      .eq('order_id', orderId)
      .in('status', ['pending', 'requested', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[ReturnApprove] Found record:', returnRecord?.id,
      'Status:', returnRecord?.status,
      'DB Error:', findError?.message);

    // If not found by order_id, try by return id directly
    if (!returnRecord) {
      console.log('[ReturnApprove] Not found by order_id, trying by return id...');
      const fallback = await supabaseAdmin
        .from('returns')
        .select('*')
        .eq('id', orderId)
        .in('status', ['pending', 'requested', 'submitted'])
        .maybeSingle();
      returnRecord = fallback.data;
      findError = fallback.error;
    }

    console.log('[ReturnApprove] Final record:', returnRecord?.id,
      'Status:', returnRecord?.status,
      'DB Error:', findError?.message);

    if (!returnRecord) {
      const { data: allReturns } = await supabaseAdmin
        .from('returns')
        .select('id, status, order_id')
        .eq('order_id', orderId);
      console.log('[ReturnApprove] All returns for this order:', allReturns);

      return res.status(400).json({
        status: 'error',
        message: `No approvable return found. Existing statuses: ${allReturns?.map(r => r.status).join(', ') || 'none'}`
      });
    }

    // Build refund payment details object
    const refundPaymentDetails = {
      mode: refundPaymentMode || order.return_request?.refundMethod || 'bank',
      bankName: refundBankName || null,
      accountNumber: refundAccountNumber || null,
      ifscCode: refundIfscCode || null,
      upiId: refundUpiId || null,
      transactionId: refundTransactionId || null,
      transactionDate: refundTransactionDate || new Date().toISOString(),
      processedBy: req.user.id,
      processedByEmail: req.user.email,
      processedAt: new Date().toISOString()
    };

    // Approval and payment are intentionally separated.
    // Payment is initiated later from the dedicated process-refund endpoint.
    const razorpayRefundId = null;

    const { data: updatedReturn, error: updateError } = await supabaseAdmin
      .from('returns')
      .update({
        status: 'approved',
        admin_notes: adminNotes || notes || null,
        refund_method: refundMethod || returnRecord.refund_method || 'original_payment_method',
        refund_amount: refundAmount || returnRecord.refund_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', returnRecord.id)
      .select()
      .single();

    if (updateError) {
      console.error('[ReturnApprove] Update failed:', updateError.message);
      return res.status(500).json({ status: 'error', message: updateError.message });
    }

    // Update order status with only verified safe columns
    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        return_status: 'approved',
        return_requested: true
      })
      .eq('id', returnRecord.order_id || orderId)
      .select()
      .single();

    if (error) {
      console.error('[ReturnApprove] Orders update error (non-blocking):', error.message);
    } else {
      console.log('[ReturnApprove] Orders table updated safely. No schema errors.');
    }

    // Step 3: Approval complete. Payment will be initiated in a separate step.
    const paymentInitiated = false;
    const paymentMessage = 'Return approved. Initiate refund after pickup, receipt, and inspection from the separate refund action.';

    console.log('[ReturnApprove] Payment status:', paymentMessage || 'No payment action');

    try {
      await supabaseAdmin.from('notifications').insert({
        type: 'RETURN_APPROVED',
        message: `Return approved for ${returnRecord.order_id}. ${paymentMessage}`,
        is_read: false,
        reference_id: returnRecord.id,
      });
    } catch (notifErr) {
      console.error('[ReturnApprove] Notification insert failed:', notifErr.message);
    }

    await logOrderEvent({
      orderId,
      userId: order.user_id || null,
      type: 'RETURN_APPROVED',
      description: `Return approved for order ${orderId}`,
    });

    console.log('[Approval] Status updated to:', 'approved');
    const approvedReturnUserEmail = order?.customer_email;
    if (!approvedReturnUserEmail) {
      console.error('User email not found - cannot send notification');
    } else {
      try {
        await sendUserNotification({
          email: approvedReturnUserEmail,
          subject: 'Your Return Has Been Approved',
          message: `Your return request for order ${orderId} has been approved. Your refund will be processed shortly.`,
        });
        console.log('[Approval] User email triggered for:', approvedReturnUserEmail);
        console.log('User notification email sent to:', approvedReturnUserEmail);
        console.log('Approval email sent to:', approvedReturnUserEmail);
      } catch (emailErr) {
        console.error('User email failed (non-blocking):', emailErr.message);
      }
    }

    // REMOVED EMAIL - SMS notification already exists below (no change needed)
    
    // Send SMS notification
    if (order.customer_phone) {
      try {
        const { sendSMS } = await import('../services/sms.service.js');
        await sendSMS(
          order.customer_phone,
          `Your return request for order #${order.order_number} has been approved. Refund of ₹${refundAmount || order.total_price} will be processed to your ${order.return_request?.refundMethod || 'account'} within 5-7 business days. - Shringarika`
        );
        console.log('✅ Return approval SMS sent to:', order.customer_phone);
      } catch (smsError) {
        console.error('⚠️ Failed to send return approval SMS:', smsError);
      }
    } else {
      console.warn('⚠️ No customer phone number - skipping SMS notification');
    }

    // 🔔 Emit RETURN_APPROVED event (admin notification + additional channels, non-blocking)
    try {
      eventBus.emit(EVENTS.RETURN_APPROVED, { order, returnData: order.return_request || {} });
    } catch (ebErr) {
      console.error('⚠️ [EventBus] emit RETURN_APPROVED failed (non-fatal):', ebErr.message);
    }

    console.log('[ReturnApprove] Successfully approved return:', returnRecord.id);

    res.status(200).json({
      status: 'success',
      message: 'Return approved successfully',
      paymentInitiated,
      paymentMessage,
      data: { order: updatedOrder, return: updatedReturn },
      razorpayRefundId: razorpayRefundId || null,
    });
  } catch (error) {
    console.error('Approve return error:', error);
    next(error);
  }
};

// @desc    Reject return request (Admin)
// @route   PUT /api/orders/:id/return/reject
// @access  Private/Admin
export const rejectReturn = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { rejectionReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    if (!['requested', 'pending'].includes(order.return_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'No pending return request for this order'
      });
    }

    // Update order to reject the return
    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        return_status: 'rejected',
        return_rejected_at: new Date().toISOString(),
        return_rejected_by: req.user.id,
        rejection_reason: rejectionReason || 'Return request rejected by admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    await logOrderEvent({
      orderId,
      userId: order.user_id || null,
      type: 'RETURN_REJECTED',
      description: `Return rejected for order ${orderId}`,
    });

    console.log('[Approval] Status updated to:', 'rejected');
    const rejectedReturnUserEmail = order?.customer_email;
    if (!rejectedReturnUserEmail) {
      console.error('User email not found - cannot send notification');
    } else {
      try {
        await sendUserNotification({
          email: rejectedReturnUserEmail,
          subject: 'Update on Your Return Request',
          message: `Your return request for order ${orderId} has been reviewed. Please contact support for further details.`,
        });
        console.log('[Approval] User email triggered for:', rejectedReturnUserEmail);
        console.log('User notification email sent to:', rejectedReturnUserEmail);
        console.log('Approval email sent to:', rejectedReturnUserEmail);
      } catch (emailErr) {
        console.error('User email failed (non-blocking):', emailErr.message);
      }
    }

    // REMOVED EMAIL - SMS notification already exists below (no change needed)
    
    // Send SMS notification
    if (order.customer_phone) {
      try {
        const { sendSMS } = await import('../services/sms.service.js');
        const smsMessage = `Your return request for order #${order.order_number} has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''} For assistance, please contact customer support. - Shringarika`;
        await sendSMS(order.customer_phone, smsMessage);
        console.log('✅ Return rejection SMS sent to:', order.customer_phone);
      } catch (smsError) {
        console.error('⚠️ Failed to send return rejection SMS:', smsError);
      }
    } else {
      console.warn('⚠️ No customer phone number - skipping SMS notification');
    }

    res.status(200).json({
      status: 'success',
      message: 'Return request rejected',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Reject return error:', error);
    next(error);
  }
};

// @desc    Approve exchange request (Admin only)
// @route   PUT /api/orders/:id/exchange/approve
// @access  Private/Admin
export const approveExchange = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { notes } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    if (order.exchange_status !== 'requested') {
      return res.status(400).json({ status: 'error', message: 'No pending exchange request for this order' });
    }

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        exchange_status: 'approved',
        exchange_approved_at: new Date().toISOString(),
        exchange_approved_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    await logOrderEvent({
      orderId,
      userId: order.user_id || null,
      type: 'EXCHANGE_APPROVED',
      description: `Exchange approved for order ${orderId}`,
    });

    console.log('[Approval] Status updated to:', 'approved');
    const approvedExchangeUserEmail = order?.customer_email;
    if (!approvedExchangeUserEmail) {
      console.error('User email not found - cannot send notification');
    } else {
      try {
        await sendUserNotification({
          email: approvedExchangeUserEmail,
          subject: 'Your Exchange Has Been Approved',
          message: `Your exchange request for order ${orderId} has been approved and will be processed within 48 hours.`,
        });
        console.log('[Approval] User email triggered for:', approvedExchangeUserEmail);
        console.log('User notification email sent to:', approvedExchangeUserEmail);
        console.log('Approval email sent to:', approvedExchangeUserEmail);
      } catch (emailErr) {
        console.error('User email failed (non-blocking):', emailErr.message);
      }
    }

    // Also update the returns table record
    await supabaseAdmin
      .from('returns')
      .update({
        status: 'approved',
        admin_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .eq('return_type', 'exchange')
      .eq('status', 'requested');

    // Send SMS notification
    if (order.customer_phone) {
      try {
        await sendSMS(
          order.customer_phone,
          `Your exchange request for order #${order.order_number} has been approved. We will process the exchange and update you shortly. - Shringarika`
        );
      } catch (smsError) {
        console.error('⚠️ Failed to send exchange approval SMS:', smsError);
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Exchange request approved',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Approve exchange error:', error);
    next(error);
  }
};

// @desc    Reject exchange request (Admin only)
// @route   PUT /api/orders/:id/exchange/reject
// @access  Private/Admin
export const rejectExchange = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { rejectionReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    if (order.exchange_status !== 'requested') {
      return res.status(400).json({ status: 'error', message: 'No pending exchange request for this order' });
    }

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({
        exchange_status: 'rejected',
        exchange_rejected_at: new Date().toISOString(),
        exchange_rejected_by: req.user.id,
        rejection_reason: rejectionReason || 'Exchange request rejected by admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    await logOrderEvent({
      orderId,
      userId: order.user_id || null,
      type: 'EXCHANGE_REJECTED',
      description: `Exchange rejected for order ${orderId}`,
    });

    console.log('[Approval] Status updated to:', 'rejected');
    const rejectedExchangeUserEmail = order?.customer_email;
    if (!rejectedExchangeUserEmail) {
      console.error('User email not found - cannot send notification');
    } else {
      try {
        await sendUserNotification({
          email: rejectedExchangeUserEmail,
          subject: 'Update on Your Exchange Request',
          message: `Your exchange request for order ${orderId} has been reviewed. Please contact support for further details.`,
        });
        console.log('[Approval] User email triggered for:', rejectedExchangeUserEmail);
        console.log('User notification email sent to:', rejectedExchangeUserEmail);
        console.log('Approval email sent to:', rejectedExchangeUserEmail);
      } catch (emailErr) {
        console.error('User email failed (non-blocking):', emailErr.message);
      }
    }

    // Also update the returns table record
    await supabaseAdmin
      .from('returns')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason || null,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .eq('return_type', 'exchange')
      .eq('status', 'requested');

    // Send SMS notification
    if (order.customer_phone) {
      try {
        const smsMessage = `Your exchange request for order #${order.order_number} has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''} For assistance, contact customer support. - Shringarika`;
        await sendSMS(order.customer_phone, smsMessage);
      } catch (smsError) {
        console.error('⚠️ Failed to send exchange rejection SMS:', smsError);
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Exchange request rejected',
      data: { order: updatedOrder }
    });
  } catch (error) {
    console.error('Reject exchange error:', error);
    next(error);
  }
};
