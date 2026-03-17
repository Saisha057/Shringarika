import crypto from 'crypto';
import { createRazorpayOrder, verifyRazorpaySignature } from '../utils/razorpay.config.js';
import { Order } from '../models/Order.model.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

// @desc    Create Razorpay order
// @route   POST /api/payment/create-order
// @access  Public (guest + logged in users)
export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    console.log('💳 [PAYMENT] Creating Razorpay order for ₹', amount, '| Receipt:', receipt);

    const rpOrder = await createRazorpayOrder(amount, currency, receipt || `rcpt_${Date.now()}`);

    console.log('✅ [PAYMENT] Razorpay order created:', rpOrder.id);

    return res.status(200).json({
      success: true,
      order: {
        id: rpOrder.id,
        amount: rpOrder.amount,   // in paise
        currency: rpOrder.currency,
        receipt: rpOrder.receipt,
      },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Create order error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create payment order' });
  }
};

// @desc    Verify UPI ID format
// @route   POST /api/payment/verify-upi
// @access  Private
export const verifyUPI = async (req, res, next) => {
  try {
    const { upiId } = req.body;
    
    if (!upiId) {
      return res.status(400).json({ status: 'error', message: 'UPI ID is required' });
    }

    const trimmedUPI = upiId.trim().toLowerCase();
    const upiRegex = /^[a-z0-9][a-z0-9.\-_]{2,255}@[a-z]{2,}$/;
    
    if (!upiRegex.test(trimmedUPI)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid UPI format. Use: name@bank (e.g., john@paytm, user@ybl)'
      });
    }
    
    console.log('✅ UPI ID validated:', trimmedUPI);
    return res.status(200).json({ status: 'success', message: 'UPI ID verified successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay payment signature and mark order as paid
// @route   POST /api/payment/verify
// @access  Public (guest + logged in users)
export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,        // our internal Supabase order UUID
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment verification fields' });
    }

    console.log('🔍 [PAYMENT] Verifying signature for payment:', razorpay_payment_id);

    // Step 1: Verify Razorpay signature
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      console.error('❌ [PAYMENT] Invalid signature!');
      return res.status(400).json({ success: false, error: 'Payment verification failed: invalid signature' });
    }

    console.log('✅ [PAYMENT] Signature verified successfully');

    // Step 2: Update order in database if order_id provided
    if (order_id) {
      try {
        await Order.update(order_id, {
          is_paid: true,
          paid_at: new Date().toISOString(),
          payment_status: 'paid',
          payment_method: 'ONLINE',
          // Store Razorpay IDs in their actual dedicated columns (payment_result does NOT exist)
          razorpay_payment_id: razorpay_payment_id || null,
          razorpay_order_id: razorpay_order_id || null,
        });
        console.log('✅ [PAYMENT] Order', order_id, 'marked as paid in database');
      } catch (dbError) {
        // Payment is verified — don't fail the whole response over a DB update issue
        console.error('⚠️ [PAYMENT] Order DB update failed (payment still valid):', dbError.message);
        return res.status(200).json({
          success: true,
          status: 'success',
          warning: 'Payment verified but order update had an issue. Contact support with payment ID: ' + razorpay_payment_id,
          payment: { razorpay_payment_id, razorpay_order_id },
        });
      }
    }

    // 🔔 Emit PAYMENT_SUCCESS event (customer payment confirmation SMS + admin, non-blocking)
    try {
      // Fetch the order object for the notification (best-effort, don't fail if unavailable)
      if (order_id) {
        const paidOrder = await Order.findById(order_id).catch(() => null);
        if (paidOrder) {
          eventBus.emit(EVENTS.PAYMENT_SUCCESS, { order: paidOrder, paymentId: razorpay_payment_id, razorpayOrderId: razorpay_order_id });
        }
      }
    } catch (ebErr) {
      console.error('⚠️ [EventBus] emit PAYMENT_SUCCESS failed (non-fatal):', ebErr.message);
    }

    return res.status(200).json({
      success: true,
      status: 'success',
      message: 'Payment verified and order updated successfully',
      payment: {
        razorpay_payment_id,
        razorpay_order_id,
        method: 'online',
      },
    });
  } catch (error) {
    console.error('❌ [PAYMENT] Verify payment error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Payment verification failed' });
  }
};

// @desc    Payment webhook (Razorpay server-side events)
// @route   POST /api/payment/webhook
// @access  Public
export const paymentWebhook = async (req, res, next) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(400).json({ status: 'error', message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    switch (event) {
      case 'payment.captured':
        console.log('✅ [WEBHOOK] Payment captured:', payment?.id);
        break;
      case 'payment.failed':
        console.log('❌ [WEBHOOK] Payment failed:', payment?.id);
        break;
      default:
        console.log('ℹ️ [WEBHOOK] Unhandled event:', event);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};


