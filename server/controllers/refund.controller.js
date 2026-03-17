import axios from 'axios';

/**
 * REFUND PROCESSING CONTROLLER WITH UPI SUPPORT
 * 
 * Handles:
 * 1) Prepaid refunds - via payment gateway refund API
 * 2) COD refunds - via UPI payout/transfer API
 */

const CONFIG = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    baseURL: 'https://api.razorpay.com/v1'
  }
};

// ============================================
// REFUND REQUEST
// ============================================

/**
 * Request refund - User initiates refund with UPI ID
 * POST /api/refund/request
 */
export async function requestRefundController(req, res, supabase) {
  try {
    const userId = req.user.id;
    const { orderId, reason, refundUpiId } = req.body;

    console.log('[REFUND-REQUEST] Request:', { userId, orderId, reason, refundUpiId });

    // Validation
    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Order ID and reason are required'
      });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found or does not belong to you'
      });
    }

    // Check if order can be refunded
    if (!['Delivered', 'Shipped'].includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Only delivered or shipped orders can be refunded'
      });
    }

    // Check if refund already requested
    const { data: existingReturn } = await supabase
      .from('returns')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (existingReturn) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_REQUESTED',
        message: 'Refund request already exists for this order'
      });
    }

    // For COD orders, UPI ID is REQUIRED
    if (order.payment_method === 'COD' && !refundUpiId) {
      return res.status(400).json({
        success: false,
        error: 'UPI_REQUIRED',
        message: 'UPI ID is required for COD order refunds'
      });
    }

    // Verify UPI ID if provided
    let upiVerified = false;
    let upiVerificationId = null;

    if (refundUpiId) {
      const { data: verification } = await supabase
        .from('upi_verifications')
        .select('*')
        .eq('upi_id', refundUpiId.trim().toLowerCase())
        .eq('status', 'verified')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!verification) {
        return res.status(400).json({
          success: false,
          error: 'UPI_NOT_VERIFIED',
          message: 'Please verify your UPI ID before requesting refund'
        });
      }

      upiVerified = true;
      upiVerificationId = verification.id;
    }

    // Create refund request
    const refundAmount = parseFloat(order.total_price || order.total_amount);

    const { data: returnRecord, error: returnError } = await supabase
      .from('returns')
      .insert({
        order_id: orderId,
        user_id: userId,
        reason: reason,
        status: 'pending',
        refund_amount: refundAmount,
        refund_upi_id: refundUpiId ? refundUpiId.trim().toLowerCase() : null,
        refund_upi_verified: upiVerified,
        refund_upi_verified_at: upiVerified ? new Date().toISOString() : null,
        refund_transfer_status: 'pending'
      })
      .select()
      .single();

    if (returnError) {
      console.error('[REFUND-REQUEST] Database error:', returnError);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to create refund request'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      returnId: returnRecord.id,
      status: returnRecord.status,
      refundAmount: refundAmount
    });
  } catch (error) {
    console.error('[REFUND-REQUEST] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process refund request'
    });
  }
}

// ============================================
// PROCESS REFUND (ADMIN)
// ============================================

/**
 * Process approved refund - Admin approves and initiates transfer
 * POST /api/refund/process
 */
export async function processRefundController(req, res, supabase) {
  try {
    const { returnId, action } = req.body; // action: 'approve' or 'reject'

    console.log('[REFUND-PROCESS] Request:', { returnId, action });

    // Validation
    if (!returnId || !action) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Return ID and action are required'
      });
    }

    // Fetch return request
    const { data: returnRecord, error: returnError } = await supabase
      .from('returns')
      .select('*, orders(*)')
      .eq('id', returnId)
      .single();

    if (returnError || !returnRecord) {
      return res.status(404).json({
        success: false,
        error: 'RETURN_NOT_FOUND',
        message: 'Return request not found'
      });
    }

    if (action === 'reject') {
      // Reject refund
      await supabase
        .from('returns')
        .update({
          status: 'rejected',
          refund_transfer_status: 'cancelled'
        })
        .eq('id', returnId);

      return res.json({
        success: true,
        message: 'Refund request rejected',
        status: 'rejected'
      });
    }

    // Approve and process refund
    const order = returnRecord.orders;

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Associated order not found'
      });
    }

    // Update status to approved
    await supabase
      .from('returns')
      .update({
        status: 'approved',
        refund_transfer_status: 'processing'
      })
      .eq('id', returnId);

    // Check payment method
    if (order.payment_method === 'COD') {
      // COD Order - Initiate UPI Payout
      return await processCODRefund(returnRecord, order, supabase, res);
    } else {
      // Prepaid Order - Initiate Gateway Refund
      return await processPrepaidRefund(returnRecord, order, supabase, res);
    }
  } catch (error) {
    console.error('[REFUND-PROCESS] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process refund'
    });
  }
}

// ============================================
// COD REFUND - UPI PAYOUT
// ============================================

async function processCODRefund(returnRecord, order, supabase, res) {
  try {
    console.log('[COD-REFUND] Processing UPI payout:', returnRecord.refund_upi_id);

    // Validate UPI ID verified
    if (!returnRecord.refund_upi_verified) {
      return res.status(400).json({
        success: false,
        error: 'UPI_NOT_VERIFIED',
        message: 'UPI ID must be verified before refund'
      });
    }

    if (!returnRecord.refund_upi_id) {
      return res.status(400).json({
        success: false,
        error: 'UPI_MISSING',
        message: 'UPI ID not provided'
      });
    }

    // Create Razorpay Payout (Transfer to UPI)
    const auth = Buffer.from(`${CONFIG.razorpay.keyId}:${CONFIG.razorpay.keySecret}`).toString('base64');

    // Step 1: Create fund account if not exists
    const fundAccountResponse = await axios.post(
      `${CONFIG.razorpay.baseURL}/fund_accounts`,
      {
        contact_id: `cont_${order.user_id}`,
        account_type: 'vpa',
        vpa: {
          address: returnRecord.refund_upi_id
        }
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const fundAccountId = fundAccountResponse.data.id;

    // Step 2: Create payout
    const payoutResponse = await axios.post(
      `${CONFIG.razorpay.baseURL}/payouts`,
      {
        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your Razorpay account
        fund_account_id: fundAccountId,
        amount: Math.round(returnRecord.refund_amount * 100), // Convert to paise
        currency: 'INR',
        mode: 'UPI',
        purpose: 'refund',
        queue_if_low_balance: true,
        reference_id: `REFUND_${returnRecord.id}`,
        narration: `Refund for Order #${order.order_number}`
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payout = payoutResponse.data;

    // Update return record
    await supabase
      .from('returns')
      .update({
        status: 'processing',
        refund_transfer_status: 'processing',
        refund_transfer_id: payout.id,
        refund_transfer_utr: payout.utr || null,
        refund_provider_reference: payout.id,
        refund_initiated_at: new Date().toISOString()
      })
      .eq('id', returnRecord.id);

    return res.json({
      success: true,
      message: 'UPI payout initiated successfully',
      payoutId: payout.id,
      status: payout.status,
      utr: payout.utr
    });
  } catch (error) {
    console.error('[COD-REFUND] Payout error:', error.response?.data || error.message);

    // Update status to failed
    await supabase
      .from('returns')
      .update({
        refund_transfer_status: 'failed',
        notes: error.response?.data?.error?.description || error.message
      })
      .eq('id', returnRecord.id);

    return res.status(500).json({
      success: false,
      error: 'PAYOUT_FAILED',
      message: error.response?.data?.error?.description || 'Failed to initiate UPI payout'
    });
  }
}

// ============================================
// PREPAID REFUND - GATEWAY REFUND
// ============================================

async function processPrepaidRefund(returnRecord, order, supabase, res) {
  try {
    console.log('[PREPAID-REFUND] Processing gateway refund:', order.id);

    // Get payment ID from order
    const paymentId = order.payment_id || order.razorpay_payment_id;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_ID_MISSING',
        message: 'Payment ID not found for this order'
      });
    }

    // Create Razorpay Refund
    const auth = Buffer.from(`${CONFIG.razorpay.keyId}:${CONFIG.razorpay.keySecret}`).toString('base64');

    const refundResponse = await axios.post(
      `${CONFIG.razorpay.baseURL}/payments/${paymentId}/refund`,
      {
        amount: Math.round(returnRecord.refund_amount * 100), // Convert to paise
        speed: 'normal',
        notes: {
          reason: returnRecord.reason,
          return_id: returnRecord.id
        },
        receipt: `REFUND_${returnRecord.id}`
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const refund = refundResponse.data;

    // Update return record
    await supabase
      .from('returns')
      .update({
        status: 'processing',
        refund_transfer_status: 'processing',
        refund_transfer_id: refund.id,
        refund_provider_reference: refund.id,
        refund_initiated_at: new Date().toISOString()
      })
      .eq('id', returnRecord.id);

    // Update order
    await supabase
      .from('orders')
      .update({
        order_status: 'Refunded',
        payment_status: 'refunded'
      })
      .eq('id', order.id);

    return res.json({
      success: true,
      message: 'Refund initiated successfully',
      refundId: refund.id,
      status: refund.status
    });
  } catch (error) {
    console.error('[PREPAID-REFUND] Refund error:', error.response?.data || error.message);

    // Update status to failed
    await supabase
      .from('returns')
      .update({
        refund_transfer_status: 'failed',
        notes: error.response?.data?.error?.description || error.message
      })
      .eq('id', returnRecord.id);

    return res.status(500).json({
      success: false,
      error: 'REFUND_FAILED',
      message: error.response?.data?.error?.description || 'Failed to initiate refund'
    });
  }
}

/**
 * Get refund status
 * GET /api/refund/status/:returnId
 */
export async function getRefundStatusController(req, res, supabase) {
  try {
    const { returnId } = req.params;
    const userId = req.user?.id;

    let query = supabase
      .from('returns')
      .select('*, orders(order_number, payment_method, total_price)')
      .eq('id', returnId);

    // If not admin, only show own refunds
    if (req.user?.role !== 'admin') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'RETURN_NOT_FOUND',
        message: 'Refund request not found'
      });
    }

    return res.json({
      success: true,
      refund: {
        id: data.id,
        orderId: data.order_id,
        orderNumber: data.orders?.order_number,
        reason: data.reason,
        status: data.status,
        refundAmount: data.refund_amount,
        refundUpiId: data.refund_upi_id,
        refundTransferStatus: data.refund_transfer_status,
        refundTransferId: data.refund_transfer_id,
        refundUtr: data.refund_transfer_utr,
        initiatedAt: data.refund_initiated_at,
        completedAt: data.refund_completed_at,
        createdAt: data.created_at
      }
    });
  } catch (error) {
    console.error('[REFUND-STATUS] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch refund status'
    });
  }
}
