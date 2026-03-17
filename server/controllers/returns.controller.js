import { getSupabaseAdmin } from '../config/supabase.js';
import { sendReturnStatusNotification } from '../services/messaging.service.js';
import { createAdminNotification } from '../services/adminNotification.service.js';
import { sendAdminNotification, sendUserNotification } from '../services/notification.service.js';
import { initiateUpiRefund, initiateBankRefund } from '../services/razorpayPayout.service.js';

// @desc    Create a return/refund/exchange request
// @route   POST /api/returns
// @access  Private (User) or Public (Guest with order ID)
export const createReturnRequest = async (req, res, next) => {
  try {
    const {
      orderId,
      returnType,
      reason,
      reasonDetails,
      returnItems,
      itemsToReturn,
      photos,
      exchangeProductId,
      exchangeVariant,
      pickupAddress,
      pickupScheduledDate,
      pickupTimeSlot,
      priorityFlag,
      customerConfirmation,
      productConditionPhotos,
      guestUuid
    } = req.body;

    const normalizedReturnItems = Array.isArray(itemsToReturn) && itemsToReturn.length > 0
      ? itemsToReturn
      : returnItems;

    const supabase = getSupabaseAdmin();

    // Validate required fields
    if (!orderId || !returnType || !reason || !normalizedReturnItems || normalizedReturnItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID, return type, reason, and items are required',
      });
    }

    // Verify order exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      });
    }

    // Verify ownership (user or guest)
    const userId = req.user?.id;
    const isGuestOrder = order.guest_uuid && guestUuid && order.guest_uuid === guestUuid;
    const isUserOrder = order.user_id && userId && order.user_id === userId;

    if (!isGuestOrder && !isUserOrder) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to request return for this order',
      });
    }

    // Calculate refund amount
    const refundAmount = normalizedReturnItems.reduce((sum, item) => {
      return sum + (Number(item.price || 0) * Number(item.quantity || 0));
    }, 0);

    // Create return request
    const returnData = {
      order_id: orderId,
      user_id: userId || null,
      guest_uuid: guestUuid || null,
      return_type: returnType,
      reason,
      reason_details: reasonDetails || null,
      return_items: normalizedReturnItems,
      photos: photos || [],
      exchange_product_id: exchangeProductId || null,
      exchange_variant: exchangeVariant || null,
      refund_amount: returnType === 'refund' ? refundAmount : 0,
      pickup_address: pickupAddress || order.shipping_address,
      status: 'requested',
      refund_status: returnType === 'refund' ? 'pending' : null,
      pickup_scheduled_date: pickupScheduledDate || null,
      pickup_time_slot: pickupTimeSlot || null,
      inspection_photos: Array.isArray(productConditionPhotos) ? productConditionPhotos : [],
      customer_confirmation: Boolean(customerConfirmation),
      priority_flag: Boolean(priorityFlag),
      sla_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    let returnRequest = null;
    let createError = null;

    ({ data: returnRequest, error: createError } = await supabase
      .from('returns')
      .insert([returnData])
      .select()
      .single());

    if (createError && /column/i.test(createError.message || '')) {
      const fallbackData = {
        order_id: orderId,
        user_id: userId || null,
        guest_uuid: guestUuid || null,
        return_type: returnType,
        reason,
        reason_details: reasonDetails || null,
        return_items: normalizedReturnItems,
        photos: photos || [],
        exchange_product_id: exchangeProductId || null,
        exchange_variant: exchangeVariant || null,
        refund_amount: returnType === 'refund' ? refundAmount : 0,
        pickup_address: pickupAddress || order.shipping_address,
        status: 'requested',
        refund_status: returnType === 'refund' ? 'pending' : null,
      };

      ({ data: returnRequest, error: createError } = await supabase
        .from('returns')
        .insert([fallbackData])
        .select()
        .single());
    }

    if (createError) {
      console.error('Error creating return request:', createError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create return request',
      });
    }

    // Update order to mark it has a return
    await supabase
      .from('orders')
      .update({
        has_return: true,
        return_requested_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    console.log(`✅ Return request created: ${returnRequest.id} for order ${orderId}`);

    const userName = req.user?.name || order.customer_name || 'a user';
    const userEmail = req.user?.email || order.customer_email || null;
    const notificationType = returnType === 'exchange' ? 'EXCHANGE_REQUESTED' : 'RETURN_REQUESTED';

    try {
      const createdNotification = await createAdminNotification({
        type: notificationType,
        message: `New ${returnType} request for order ${orderId} by ${userName || 'a user'}`,
        referenceId: returnRequest.id
      });

      if (!createdNotification) {
        const notificationInsert = {
          type: notificationType,
          message: `New ${returnType} request from ${userName || userEmail || 'a customer'} for order ${orderId}. Product: ${normalizedReturnItems?.[0]?.productName || normalizedReturnItems?.[0]?.product_name || 'N/A'}. Amount: Rs.${returnRequest.refund_amount || 0}.`,
          is_read: false,
          reference_id: returnRequest.id,
          created_at: new Date().toISOString(),
        };

        console.log('[ReturnController] Inserting notification:', notificationInsert);

        const { data: notifData, error: notifError } = await supabase
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
        console.log(returnType === 'exchange' ? '[Exchange] Notification insert called' : `Admin notification created for return: ${returnRequest.id}`);
      }
    } catch (notifError) {
      console.error('[ReturnController] Notification try/catch error:', notifError.message);
    }

    try {
      console.log('[Email] sendAdminNotification called for type:', returnType === 'exchange' ? 'Exchange' : 'Return');
      console.log('Sending admin notification email...');
      await sendAdminNotification({
        type: returnType === 'exchange' ? 'Exchange' : 'Return',
        order: { id: orderId },
        product: { name: normalizedReturnItems?.[0]?.productName || normalizedReturnItems?.[0]?.product_name || 'N/A', variant: 'N/A' },
        user: { name: userName, email: userEmail || 'N/A' },
        reason,
      });
      console.log('[Email] Admin email sent successfully');
      console.log('Admin email sent successfully');
    } catch (emailError) {
      console.error('Admin email failed (non-blocking):', emailError.message);
    }

    res.status(201).json({
      status: 'success',
      data: { return: returnRequest },
      message: 'Return request submitted successfully',
    });
  } catch (error) {
    console.error('createReturnRequest error:', error);
    next(error);
  }
};

// @desc    Get all returns (Admin only)
// @route   GET /api/returns
// @access  Private/Admin
export const getAllReturns = async (req, res, next) => {
  console.log('[Returns] Controller entered');
  console.log('RETURNS API HIT');

  try {
    const supabase = getSupabaseAdmin();
    const { status, returnType, orderBy = 'created_at' } = req.query;

    console.log('Fetching returns');

    // Step 1: Query only returns table first (no joins) to avoid hidden relationship failures.
    let baseQuery = supabase.from('returns').select('*');

    if (status) {
      baseQuery = baseQuery.eq('status', status);
    }

    if (returnType) {
      baseQuery = baseQuery.eq('return_type', returnType);
    }

    const { data: baseReturns, error: baseError } = await baseQuery.order(orderBy, { ascending: false });
    console.log('[Returns] Fetched count:', baseReturns?.length, 'Error:', baseError?.message);
    console.log('Returns fetched:', baseReturns?.length, 'Error:', baseError ? baseError.message : null);

    if (baseError) {
      console.error('Error fetching returns:', baseError.message);
      return res.status(500).json({
        status: 'error',
        message: baseError.message,
      });
    }

    const safeReturns = Array.isArray(baseReturns) ? baseReturns : [];
    const orderIds = [...new Set(safeReturns.map((ret) => ret.order_id).filter(Boolean))];
    const userIds = [...new Set(safeReturns.map((ret) => ret.user_id).filter(Boolean))];

    let ordersById = {};
    let usersById = {};
    let eventsByOrderId = {};

    if (orderIds.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, customer_phone, user_id')
        .in('id', orderIds);

      console.log('[Returns] Orders join count:', orders?.length, 'Error:', ordersError?.message);
      if (!ordersError && Array.isArray(orders)) {
        ordersById = orders.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      } else if (ordersError) {
        console.error('[Returns] Orders join error (non-blocking):', ordersError.message);
      }

      const { data: events, error: eventsError } = await supabase
        .from('order_events')
        .select('order_id, event_type, description, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });

      console.log('[Returns] order_events join count:', events?.length, 'Error:', eventsError?.message);
      if (!eventsError && Array.isArray(events)) {
        eventsByOrderId = events.reduce((acc, eventRow) => {
          if (!acc[eventRow.order_id]) {
            acc[eventRow.order_id] = [];
          }
          acc[eventRow.order_id].push(eventRow);
          return acc;
        }, {});
      } else if (eventsError) {
        console.error('[Returns] order_events join error (non-blocking):', eventsError.message);
      }
    }

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', userIds);

      console.log('[Returns] Users join count:', users?.length, 'Error:', usersError?.message);
      if (!usersError && Array.isArray(users)) {
        usersById = users.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      } else if (usersError) {
        console.error('[Returns] Users join error (non-blocking):', usersError.message);
      }
    }

    const enhancedReturns = safeReturns.map((ret) => {
      const firstItem = Array.isArray(ret.return_items) ? ret.return_items[0] : null;
      const orderRow = ordersById[ret.order_id] || null;
      const userRow = usersById[ret.user_id] || null;

      return {
        ...ret,
        orders: orderRow,
        users: userRow,
        customer_name: orderRow?.customer_name || userRow?.name || 'Guest User',
        customer_email: orderRow?.customer_email || userRow?.email || 'N/A',
        customer_phone: orderRow?.customer_phone || userRow?.phone || 'N/A',
        timeline: eventsByOrderId[ret.order_id] || [],
        variant_info: {
          original_size: firstItem?.original_size || null,
          original_color: firstItem?.original_color || null,
          new_size: firstItem?.new_size || null,
          new_color: firstItem?.new_color || null,
        },
      };
    });

    console.log(`📦 Fetched ${enhancedReturns.length} return requests with customer details`);

    return res.status(200).json({
      status: 'success',
      data: { returns: enhancedReturns },
    });
  } catch (error) {
    console.error('Returns controller error:', error.message, error.stack);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get returns for a specific user
// @route   GET /api/returns/my-returns
// @access  Private (User)
export const getMyReturns = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const userId = req.user.id;

    const { data: returns, error } = await supabase
      .from('returns')
      .select('*, orders!inner(order_number, total_price)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user returns:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch returns',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { returns },
    });
  } catch (error) {
    console.error('getMyReturns error:', error);
    next(error);
  }
};

// @desc    Get return by ID
// @route   GET /api/returns/:id
// @access  Private
export const getReturnById = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: returnRequest, error } = await supabase
      .from('returns')
      .select('*, orders!inner(*)')
      .eq('id', id)
      .single();

    if (error || !returnRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Return request not found',
      });
    }

    // Verify access (admin or owner)
    const isAdmin = req.user?.role === 'admin';
    const isOwner = returnRequest.user_id === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { return: returnRequest },
    });
  } catch (error) {
    console.error('getReturnById error:', error);
    next(error);
  }
};

// @desc    Update return status (Admin)
// @route   PUT /api/returns/:id/status
// @access  Private/Admin
export const updateReturnStatus = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const {
      status,
      adminNotes,
      rejectionReason,
      itemCondition,
      resellable,
      trackingNumber,
      pickupDate,
    } = req.body;

    console.log('[ReturnStatus] Updating return:', id, 'to status:', status);
    console.log('[ReturnStatus] Request body:', req.body);

    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid return ID',
      });
    }

    if (!status) {
      return res.status(400).json({
        status: 'error',
        message: 'Status is required',
      });
    }

    // Diagnostic: fetch current record to confirm it exists
    const { data: existing, error: fetchError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      console.error('[ReturnStatus] Record not found:', fetchError?.message);
      return res.status(404).json({ error: 'Return not found', detail: fetchError?.message });
    }

    console.log('[ReturnStatus] Existing record keys:', Object.keys(existing));
    console.log('[ReturnStatus] Current status:', existing.status);

    const existingKeys = new Set(Object.keys(existing));
    const updateData = {
      status,
    };

    if ((adminNotes || req.body?.notes) && existingKeys.has('admin_notes')) {
      updateData.admin_notes = adminNotes || req.body?.notes || null;
    }
    if (req.body?.inspectionNotes && existingKeys.has('inspection_notes')) {
      updateData.inspection_notes = req.body.inspectionNotes;
    }
    if (rejectionReason && existingKeys.has('rejection_reason')) {
      updateData.rejection_reason = rejectionReason;
    }
    if (itemCondition && existingKeys.has('item_condition')) {
      updateData.item_condition = itemCondition;
    }
    if (resellable !== undefined && existingKeys.has('resellable')) {
      updateData.resellable = resellable;
    }
    if (trackingNumber && existingKeys.has('tracking_number')) {
      updateData.tracking_number = trackingNumber;
    }
    if (pickupDate && existingKeys.has('pickup_date')) {
      updateData.pickup_date = pickupDate;
    }
    if (existingKeys.has('updated_at')) {
      updateData.updated_at = new Date().toISOString();
    }

    if (status === 'picked_up') {
      const rawNotes = String(adminNotes || req.body?.notes || '').split('|').map(p => p.trim());
      const carrierPart = rawNotes.find(p => p.toLowerCase().startsWith('carrier:'));
      const awbPart = rawNotes.find(p => p.toLowerCase().startsWith('awb:'));

      if (carrierPart && existingKeys.has('carrier_name')) {
        updateData.carrier_name = carrierPart.replace(/carrier:/i, '').trim() || null;
      }
      if (awbPart && existingKeys.has('tracking_number')) {
        updateData.tracking_number = awbPart.replace(/awb:/i, '').trim() || null;
      }
      if (existingKeys.has('refund_initiated_at')) {
        updateData.refund_initiated_at = null;
      }
    }

    if (status === 'refunded' && existingKeys.has('refund_completed_at')) {
      updateData.refund_completed_at = new Date().toISOString();
    }

    console.log('[ReturnStatus] Update payload:', updateData);

    const { data: updatedReturn, error } = await supabase
      .from('returns')
      .update(updateData)
      .eq('id', id)
      .select('*, orders!inner(*)')
      .single();

    if (error) {
      console.error('[ReturnStatus] Supabase error:', error.message, error.details, error.hint);
      return res.status(500).json({
        status: 'error',
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }

    if (!updatedReturn) {
      console.error('[ReturnStatus] No return found with id:', id);
      return res.status(404).json({
        status: 'error',
        message: 'Return record not found',
      });
    }

    console.log(`✅ Return ${id} status updated to: ${status}`);
    console.log('[Approval] Status updated to:', status);

    const userEmail = updatedReturn.orders?.customer_email || updatedReturn.orders?.users?.email;
    const orderId = updatedReturn.order_id || updatedReturn.orders?.id;

    if ((status === 'approved' || status === 'rejected') && userEmail) {
      try {
        await sendUserNotification({
          email: userEmail,
          subject: status === 'approved'
            ? 'Your Return Has Been Approved'
            : 'Update on Your Return Request',
          message: status === 'approved'
            ? `Your return request for order ${orderId} has been approved. Your refund will be processed shortly.`
            : `Your return request for order ${orderId} has been reviewed. Please contact support for further details.`
        });
        console.log('[Approval] User email triggered for:', userEmail);
        console.log('Approval email sent to:', userEmail);
      } catch (emailErr) {
        console.error('User email failed (non-blocking):', emailErr.message);
      }
    } else if (status === 'approved' || status === 'rejected') {
      console.error('User email not found — cannot send notification');
    }

    // Send SMS/WhatsApp notification to customer
    if (updatedReturn.orders?.customer_phone) {
      try {
        await sendReturnStatusNotification(updatedReturn.orders.customer_phone, {
          orderNumber: updatedReturn.orders.order_number,
          status: status,
          type: updatedReturn.return_type,
          reason: rejectionReason || null,
        });
        console.log(`📱 Notification sent to customer for return ${id}`);
      } catch (notificationError) {
        console.error('❌ Failed to send notification:', notificationError);
        // Continue even if notification fails
      }
    }

    // Sync return status to orders table for user visibility
    if (updatedReturn?.order_id) {
      await supabase
        .from('orders')
        .update({ return_status: status })
        .eq('id', updatedReturn.order_id);
      console.log('[ReturnStatus] Synced status to orders table:', status);
    }

    // If approved and type is exchange, handle stock adjustment
    if (status === 'approved' && updatedReturn.return_type === 'exchange') {
      // TODO: Adjust stock for exchange items
      console.log('📦 Exchange approved - stock adjustment needed');
    }

    console.log('[ReturnStatus] Successfully updated to:', status);

    res.status(200).json({
      status: 'success',
      data: { return: updatedReturn },
      message: 'Return status updated successfully',
    });
  } catch (error) {
    console.error('updateReturnStatus error:', error);
    next(error);
  }
};

// @desc    Process return refund via payout flow (Admin)
// @route   POST /api/returns/:returnId/process-refund
// @access  Private/Admin
export const processReturnRefund = async (req, res) => {
  try {
    const { returnId } = req.params;
    const {
      refundMethod,
      upiId,
      accountNumber,
      ifscCode,
      accountHolderName,
      amount,
      adminNotes,
    } = req.body;

    console.log('[ProcessRefund] Starting refund for return:', returnId);
    console.log('[ProcessRefund] Method:', refundMethod, 'Amount:', amount);

    if (!returnId || returnId === 'undefined') {
      return res.status(400).json({ error: 'Invalid return id' });
    }

    const supabase = getSupabaseAdmin();

    const { data: returnRecord } = await supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();

    if (!returnRecord) {
      return res.status(404).json({ error: 'Return not found' });
    }

    let payoutResult = null;

    if (refundMethod === 'upi') {
      if (!upiId) {
        return res.status(400).json({ error: 'UPI ID is required for UPI refund' });
      }

      payoutResult = await initiateUpiRefund({
        upiId,
        amount: amount || returnRecord.refund_amount,
        returnId,
        customerName: accountHolderName || returnRecord.customer_name || 'Customer',
        notes: adminNotes,
      });
    } else if (refundMethod === 'bank_transfer') {
      if (!accountNumber || !ifscCode || !accountHolderName) {
        return res.status(400).json({
          error: 'Account number, IFSC code, and account holder name are required',
        });
      }

      payoutResult = await initiateBankRefund({
        accountNumber,
        ifscCode,
        accountHolderName,
        amount: amount || returnRecord.refund_amount,
        returnId,
      });
    } else if (refundMethod === 'store_credit') {
      payoutResult = { success: true, payoutId: 'store_credit', status: 'processed' };
      console.log('[ProcessRefund] Store credit - updating wallet');
    } else {
      payoutResult = { success: true, payoutId: 'original_pm', status: 'initiated' };
      console.log('[ProcessRefund] Original payment method - manual processing');
    }

    if (!payoutResult?.success) {
      console.error('[ProcessRefund] Payout failed:', payoutResult?.error);
      return res.status(500).json({
        error: 'Refund initiation failed',
        detail: payoutResult?.error,
      });
    }

    await supabase
      .from('returns')
      .update({
        status: 'refunded',
        refund_initiated_at: new Date().toISOString(),
        refund_completed_at: new Date().toISOString(),
        refund_transaction_id: payoutResult.payoutId || null,
        admin_notes: [adminNotes, `Payout ID: ${payoutResult.payoutId}`]
          .filter(Boolean)
          .join(' | '),
      })
      .eq('id', returnId);

    if (returnRecord.order_id) {
      await supabase
        .from('orders')
        .update({ return_status: 'refunded' })
        .eq('id', returnRecord.order_id);
    }

    console.log('[ProcessRefund] Refund completed:', payoutResult.payoutId);
    return res.json({
      status: 'success',
      message: 'Refund initiated successfully',
      payoutId: payoutResult.payoutId,
      payoutStatus: payoutResult.status,
    });
  } catch (error) {
    console.error('[ProcessRefund] Unexpected error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// @desc    Process refund (Admin)
// @route   POST /api/returns/:id/refund
// @access  Private/Admin
export const processRefund = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { refundMethod, refundReference, refundAmount } = req.body;

    // Get return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('returns')
      .select('*, orders!inner(*)')
      .eq('id', id)
      .single();

    if (fetchError || !returnRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Return request not found',
      });
    }

    if (returnRequest.status !== 'approved' && returnRequest.status !== 'accepted') {
      return res.status(400).json({
        status: 'error',
        message: 'Return must be approved before processing refund',
      });
    }

    // Update return with refund details
    const { data: updatedReturn, error: updateError } = await supabase
      .from('returns')
      .update({
        refund_status: 'completed',
        refund_method: refundMethod || 'original_payment_method',
        refund_reference: refundReference || null,
        refund_amount: refundAmount || returnRequest.refund_amount,
        refunded_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error processing refund:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process refund',
      });
    }

    // Update order refund fields
    await supabase
      .from('orders')
      .update({
        refund_amount: refundAmount || returnRequest.refund_amount,
        refund_status: 'completed',
        refunded_at: new Date().toISOString(),
        order_status: 'Refunded',
      })
      .eq('id', returnRequest.order_id);

    console.log(`💰 Refund processed: ₹${refundAmount || returnRequest.refund_amount} for return ${id}`);

    res.status(200).json({
      status: 'success',
      data: { return: updatedReturn },
      message: 'Refund processed successfully',
    });
  } catch (error) {
    console.error('processRefund error:', error);
    next(error);
  }
};

// @desc    Process exchange (Admin)
// @route   POST /api/returns/:id/exchange
// @access  Private/Admin
export const processExchange = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { exchangeProductId, exchangeVariant, trackingNumber } = req.body;

    // Get return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('returns')
      .select('*, orders!inner(*)')
      .eq('id', id)
      .single();

    if (fetchError || !returnRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Return request not found',
      });
    }

    if (returnRequest.return_type !== 'exchange') {
      return res.status(400).json({
        status: 'error',
        message: 'This is not an exchange request',
      });
    }

    // Update return with exchange details
    const { data: updatedReturn, error: updateError } = await supabase
      .from('returns')
      .update({
        exchange_product_id: exchangeProductId,
        exchange_variant: exchangeVariant,
        tracking_number: trackingNumber || null,
        status: 'completed',
        exchange_details: {
          processedAt: new Date().toISOString(),
          trackingNumber: trackingNumber || null,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error processing exchange:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process exchange',
      });
    }

    console.log(`🔄 Exchange processed for return ${id}`);

    // TODO: Create new order or update existing order with exchanged items
    // TODO: Adjust stock for both returned and exchanged items

    res.status(200).json({
      status: 'success',
      data: { return: updatedReturn },
      message: 'Exchange processed successfully',
    });
  } catch (error) {
    console.error('processExchange error:', error);
    next(error);
  }
};

// @desc    Restock returned items (Admin)
// @route   POST /api/returns/:id/restock
// @access  Private/Admin
export const restockReturnedItems = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { itemsToRestock } = req.body;

    // Get return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !returnRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Return request not found',
      });
    }

    if (!returnRequest.resellable) {
      return res.status(400).json({
        status: 'error',
        message: 'Items are marked as not resellable',
      });
    }

    // Update return status
    await supabase
      .from('returns')
      .update({
        admin_notes: 'Items restocked to inventory',
      })
      .eq('id', id);

    console.log(`📦 Restocked items from return ${id}`);

    // TODO: Update product stock quantities in products table

    res.status(200).json({
      status: 'success',
      message: 'Items restocked successfully',
    });
  } catch (error) {
    console.error('restockReturnedItems error:', error);
    next(error);
  }
};

// @desc    Cancel return request (User or Admin)
// @route   PUT /api/returns/:id/cancel
// @access  Private
export const cancelReturnRequest = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { cancellationReason } = req.body;

    // Get return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !returnRequest) {
      return res.status(404).json({
        status: 'error',
        message: 'Return request not found',
      });
    }

    // Verify ownership or admin
    const isAdmin = req.user?.role === 'admin';
    const isOwner = returnRequest.user_id === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied',
      });
    }

    // Update return status
    const { data: updatedReturn, error: updateError } = await supabase
      .from('returns')
      .update({
        status: 'cancelled',
        admin_notes: cancellationReason || 'Cancelled by user',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling return:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to cancel return request',
      });
    }

    console.log(`❌ Return ${id} cancelled`);

    res.status(200).json({
      status: 'success',
      data: { return: updatedReturn },
      message: 'Return request cancelled successfully',
    });
  } catch (error) {
    console.error('cancelReturnRequest error:', error);
    next(error);
  }
};

// @desc    Get returns statistics (Admin)
// @route   GET /api/returns/stats
// @access  Private/Admin
export const getReturnsStatistics = async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    // Get all returns
    const { data: returns, error } = await supabase
      .from('returns')
      .select('*');

    if (error) {
      console.error('Error fetching returns stats:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch statistics',
      });
    }

    // Calculate statistics
    const stats = {
      totalReturns: returns.length,
      byStatus: {
        requested: returns.filter(r => r.status === 'requested').length,
        underReview: returns.filter(r => r.status === 'under_review').length,
        approved: returns.filter(r => r.status === 'approved').length,
        rejected: returns.filter(r => r.status === 'rejected').length,
        completed: returns.filter(r => r.status === 'completed').length,
        cancelled: returns.filter(r => r.status === 'cancelled').length,
      },
      byType: {
        return: returns.filter(r => r.return_type === 'return').length,
        refund: returns.filter(r => r.return_type === 'refund').length,
        exchange: returns.filter(r => r.return_type === 'exchange').length,
      },
      totalRefundAmount: returns
        .filter(r => r.refund_status === 'completed')
        .reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
      pendingRefundAmount: returns
        .filter(r => r.refund_status === 'approved' || r.refund_status === 'processing')
        .reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
      resellableItems: returns.filter(r => r.resellable === true).length,
    };

    console.log('📊 Returns statistics calculated');

    res.status(200).json({
      status: 'success',
      data: { stats },
    });
  } catch (error) {
    console.error('getReturnsStatistics error:', error);
    next(error);
  }
};
