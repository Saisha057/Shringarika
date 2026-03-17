import express from 'express';
import { protect, admin } from '../middleware/auth.middleware.js';
import { 
  requestRefundController, 
  processRefundController, 
  getRefundStatusController 
} from '../controllers/refund.controller.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// REFUND ROUTES
// ============================================

/**
 * POST /api/refund/request
 * User requests a refund (with UPI ID for COD orders)
 * Requires authentication
 */
router.post('/request', protect, (req, res) => {
  requestRefundController(req, res, supabase);
});

/**
 * POST /api/refund/process
 * Admin approves/rejects and processes refund
 * Requires admin role
 */
router.post('/process', protect, admin, (req, res) => {
  processRefundController(req, res, supabase);
});

/**
 * GET /api/refund/status/:returnId
 * Get refund status
 * Requires authentication
 */
router.get('/status/:returnId', protect, (req, res) => {
  getRefundStatusController(req, res, supabase);
});

/**
 * GET /api/refund/my-refunds
 * Get all refund requests for logged-in user
 * Requires authentication
 */
router.get('/my-refunds', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('returns')
      .select('*, orders(order_number, total_price, payment_method)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MY-REFUNDS] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch refunds'
      });
    }

    return res.json({
      success: true,
      refunds: data.map(r => ({
        id: r.id,
        orderId: r.order_id,
        orderNumber: r.orders?.order_number,
        reason: r.reason,
        status: r.status,
        refundAmount: r.refund_amount,
        refundTransferStatus: r.refund_transfer_status,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('[MY-REFUNDS] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch refunds'
    });
  }
});

/**
 * GET /api/refund/admin/pending
 * Get all pending refund requests for admin
 * Requires admin role
 */
router.get('/admin/pending', protect, admin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('returns')
      .select('*, orders(order_number, total_price, payment_method, user_id), users:user_id(name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ADMIN-PENDING] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch pending refunds'
      });
    }

    return res.json({
      success: true,
      refunds: data.map(r => ({
        id: r.id,
        orderId: r.order_id,
        orderNumber: r.orders?.order_number,
        customerName: r.users?.name,
        customerEmail: r.users?.email,
        reason: r.reason,
        refundAmount: r.refund_amount,
        refundUpiId: r.refund_upi_id,
        refundUpiVerified: r.refund_upi_verified,
        paymentMethod: r.orders?.payment_method,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('[ADMIN-PENDING] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch pending refunds'
    });
  }
});

export default router;
