import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../config/supabase.js';

// Initialize Razorpay instance lazily (after .env is loaded)
let razorpay = null;
let razorpayInitAttempted = false;

function initializeRazorpay() {
  if (razorpayInitAttempted) return razorpay;
  
  razorpayInitAttempted = true;
  
  try {
    console.log('🔍 Razorpay Debug - KEY_ID:', process.env.RAZORPAY_KEY_ID);
    console.log('🔍 Razorpay Debug - KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set (hidden)' : 'Not set');
    
    if (
      process.env.RAZORPAY_KEY_ID && 
      process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_KEY_ID.includes('dummy') &&
      !process.env.RAZORPAY_KEY_SECRET.includes('dummy')
    ) {
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      console.log('✅ Razorpay initialized successfully');
    } else {
      console.warn('⚠️ Razorpay disabled - Add real API keys to .env to enable');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Razorpay:', error.message);
  }
  
  return razorpay;
}

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay order
 * @access  Public
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    // Initialize Razorpay if not already done
    const rzp = initializeRazorpay();
    
    // Check if Razorpay is initialized
    if (!rzp) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay is not configured. Please add valid API keys to enable online payments.',
      });
    }

    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await rzp.orders.create(options);

    console.log('✅ Razorpay order created:', order.id);

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      key: process.env.RAZORPAY_KEY_ID, // Send key_id to frontend
    });
  } catch (error) {
    console.error('❌ Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Razorpay order',
    });
  }
};

/**
 * @route   POST /api/payments/verify-payment
 * @desc    Verify Razorpay payment signature
 * @access  Public
 */
export const verifyRazorpayPayment = async (req, res) => {
  try {
    console.log('🔍 [VERIFY-PAYMENT] ========== REQUEST RECEIVED ==========');
    console.log('🔍 [VERIFY-PAYMENT] Body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [VERIFY-PAYMENT] Headers:', req.headers);

    // Initialize Razorpay if not already done
    const rzp = initializeRazorpay();
    
    // Check if Razorpay is initialized
    if (!rzp) {
      console.error('❌ [VERIFY-PAYMENT] Razorpay not initialized');
      return res.status(503).json({
        success: false,
        error: 'Razorpay is not configured. Please add valid API keys.',
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id, // Our internal order ID
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error('❌ [VERIFY-PAYMENT] Missing required parameters:', {
        has_razorpay_order_id: !!razorpay_order_id,
        has_razorpay_payment_id: !!razorpay_payment_id,
        has_razorpay_signature: !!razorpay_signature,
        has_order_id: !!order_id
      });
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification parameters. Required: razorpay_order_id, razorpay_payment_id, razorpay_signature',
      });
    }

    console.log('✅ [VERIFY-PAYMENT] All required parameters present');

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    console.log('🔍 [VERIFY-PAYMENT] Signature verification:', {
      body_string: body,
      expected: expectedSignature.substring(0, 20) + '...',
      received: razorpay_signature.substring(0, 20) + '...',
      matches: isAuthentic
    });

    if (!isAuthentic) {
      console.error('❌ [VERIFY-PAYMENT] Invalid payment signature - FRAUD ALERT');
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - invalid signature. This payment cannot be trusted.',
      });
    }

    console.log('✅ [VERIFY-PAYMENT] Payment signature verified successfully:', razorpay_payment_id);

    // Fetch payment details from Razorpay
    console.log('🔍 [VERIFY-PAYMENT] Fetching payment details from Razorpay...');
    let payment;
    try {
      payment = await rzp.payments.fetch(razorpay_payment_id);
      console.log('✅ [VERIFY-PAYMENT] Payment details fetched:', {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method
      });
    } catch (fetchError) {
      console.error('❌ [VERIFY-PAYMENT] Failed to fetch payment details from Razorpay:', fetchError);
      // Continue anyway - signature is verified, which is most important
      payment = {
        id: razorpay_payment_id,
        amount: 0,
        method: 'online',
        status: 'captured',
        currency: 'INR'
      };
    }

    // Update order in database if order_id is provided
    if (order_id) {
      const supabase = getSupabaseAdmin();
      
      console.log('🔍 [VERIFY-PAYMENT] Updating order in database:', order_id);
      
      const updateData = {
        payment_method: payment.method || 'online',
        payment_status: 'paid',
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        order_status: 'Confirmed', // Auto-confirm paid orders
        is_paid: true, // Mark as paid
        updated_at: new Date().toISOString()
      };

      console.log('🔍 [VERIFY-PAYMENT] Update data:', updateData);
      
      // Try to find order by order_number first (primary method)
      let { data: order, error: orderError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('order_number', order_id)
        .select()
        .single();

      // If not found by order_number, try by id (UUID)
      if (orderError && orderError.code === 'PGRST116') {
        console.log('⚠️ [VERIFY-PAYMENT] Order not found by order_number, trying by id (UUID)...');
        
        const result = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id)
          .select()
          .single();
        
        order = result.data;
        orderError = result.error;
      }

      if (orderError) {
        console.error('❌ [VERIFY-PAYMENT] Failed to update order after trying both methods:', {
          order_id: order_id,
          error: orderError,
          code: orderError.code,
          message: orderError.message,
          details: orderError.details
        });
        
        // CRITICAL: Payment is verified, but DB update failed
        // Return success=true but with a warning
        return res.status(200).json({
          success: true,
          warning: 'Payment verified successfully but order update failed. Please contact support.',
          payment: {
            id: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            method: payment.method,
            status: payment.status,
          },
          razorpay_payment_id,
          order_id,
          error_details: {
            order_identifier: order_id,
            error_code: orderError.code,
            tried: ['order_number', 'id']
          }
        });
      }

      console.log('✅ [VERIFY-PAYMENT] Order updated successfully:', {
        order_id: order.id,
        order_number: order.order_number,
        payment_status: order.payment_status,
        order_status: order.order_status,
        is_paid: order.is_paid
      });
    } else {
      console.log('⚠️ [VERIFY-PAYMENT] No order_id provided, skipping DB update');
    }

    console.log('✅ [VERIFY-PAYMENT] ========== SUCCESS ==========');
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: payment.id,
        amount: payment.amount / 100, // Convert from paise to rupees
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        created_at: payment.created_at,
      },
    });
  } catch (error) {
    console.error('❌ [VERIFY-PAYMENT] Error occurred:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // ✅ CRITICAL FIX: Always send a response, even on error
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Payment verification failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    } else {
      console.error('❌ [VERIFY-PAYMENT] Response already sent, cannot send error response');
    }
  }
};

/**
 * @route   GET /api/payments/payment/:paymentId
 * @desc    Fetch payment details from Razorpay
 * @access  Private (Admin)
 */
export const getPaymentDetails = async (req, res) => {
  try {
    // Initialize Razorpay if not already done
    const rzp = initializeRazorpay();
    
    if (!rzp) {
      return res.status(503).json({ success: false, error: 'Razorpay not configured' });
    }
    
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required',
      });
    }

    const payment = await rzp.payments.fetch(paymentId);

    res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        created_at: payment.created_at,
        captured: payment.captured,
      },
    });
  } catch (error) {
    console.error('❌ Failed to fetch payment details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment details',
    });
  }
};

/**
 * @route   POST /api/payments/refund
 * @desc    Initiate refund for a payment
 * @access  Private (Admin)
 */
export const initiateRefund = async (req, res) => {
  try {
    // Initialize Razorpay if not already done
    const rzp = initializeRazorpay();
    
    if (!rzp) {
      return res.status(503).json({ success: false, error: 'Razorpay not configured' });
    }
    
    const { paymentId, amount, notes } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required',
      });
    }

    const refundOptions = {
      amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
      notes: notes || {},
    };

    const refund = await rzp.payments.refund(paymentId, refundOptions);

    console.log('✅ Refund initiated:', refund.id);

    res.status(200).json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        created_at: refund.created_at,
      },
    });
  } catch (error) {
    console.error('❌ Refund initiation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate refund',
    });
  }
};
