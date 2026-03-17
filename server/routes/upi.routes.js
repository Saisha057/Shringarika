import express from 'express';
import { protect, optional } from '../middleware/auth.middleware.js';
import { verifyUPIController, validateUPIFormatController } from '../controllers/upi.verification.controller.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for backend operations
);

// ============================================
// UPI VERIFICATION ROUTES
// ============================================

/**
 * POST /api/upi/validate-format
 * Fast client-side format validation (no gateway call)
 * Public endpoint - no auth required
 */
router.post('/validate-format', (req, res) => {
  validateUPIFormatController(req, res);
});

/**
 * POST /api/upi/verify
 * Real UPI ID verification via payment gateway
 * Requires authentication (optional for payment, required for refund)
 */
router.post('/verify', optional, (req, res) => {
  verifyUPIController(req, res, supabase);
});

/**
 * GET /api/upi/verification-history
 * Get user's UPI verification history
 * Requires authentication
 */
router.get('/verification-history', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('upi_verifications')
      .select('id, upi_id, status, verified_name, provider, context, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[UPI-HISTORY] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch verification history'
      });
    }

    return res.json({
      success: true,
      verifications: data || []
    });
  } catch (error) {
    console.error('[UPI-HISTORY] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch verification history'
    });
  }
});

/**
 * GET /api/upi/check-verified/:upiId
 * Check if a UPI ID was verified recently (cached result)
 * Public endpoint - for quick lookups
 */
router.get('/check-verified/:upiId', async (req, res) => {
  try {
    const { upiId } = req.params;

    // Normalize UPI ID
    const normalizedUpiId = upiId.trim().toLowerCase();

    const { data, error } = await supabase
      .from('upi_verifications')
      .select('verified_name, provider, created_at')
      .eq('upi_id', normalizedUpiId)
      .eq('status', 'verified')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[UPI-CHECK] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR'
      });
    }

    if (data) {
      return res.json({
        success: true,
        verified: true,
        verifiedName: data.verified_name,
        verifiedAt: data.created_at
      });
    } else {
      return res.json({
        success: true,
        verified: false
      });
    }
  } catch (error) {
    console.error('[UPI-CHECK] Controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR'
    });
  }
});

export default router;
