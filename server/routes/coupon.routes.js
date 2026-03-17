import express from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { getSupabase } from '../config/supabase.js';

const router = express.Router();

// Validation rules
const couponValidation = [
  body('code').trim().toUpperCase().notEmpty().withMessage('Coupon code is required'),
  body('discount_type').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Discount value must be positive'),
];

// @desc    Validate and apply coupon
// @route   POST /api/coupons/validate
// @access  Private
router.post('/validate', protect, async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const supabase = getSupabase();

    // Get coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return res.status(404).json({
        status: 'error',
        message: 'Invalid or expired coupon code'
      });
    }

    // Check validity period
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({
        status: 'error',
        message: 'Coupon is not yet valid'
      });
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({
        status: 'error',
        message: 'Coupon has expired'
      });
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({
        status: 'error',
        message: 'Coupon usage limit reached'
      });
    }

    // Check minimum order value
    if (coupon.min_order_value && cartTotal < coupon.min_order_value) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum order value of ₹${coupon.min_order_value} required`
      });
    }

    // Check if user already used this coupon
    const { data: usage } = await supabase
      .from('coupon_usage')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', req.user.id)
      .single();

    if (usage) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already used this coupon'
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (cartTotal * coupon.discount_value) / 100;
      if (coupon.max_discount) {
        discountAmount = Math.min(discountAmount, coupon.max_discount);
      }
    } else {
      discountAmount = coupon.discount_value;
    }

    discountAmount = Math.min(discountAmount, cartTotal);

    res.json({
      status: 'success',
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        discount_amount: discountAmount,
        final_amount: cartTotal - discountAmount,
        description: coupon.description
      }
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error validating coupon'
    });
  }
});

// @desc    Record coupon usage
// @route   POST /api/coupons/use
// @access  Private
router.post('/use', protect, async (req, res) => {
  try {
    const { coupon_id, order_id, discount_amount } = req.body;
    const supabase = getSupabase();

    // Record usage
    await supabase.from('coupon_usage').insert({
      coupon_id,
      user_id: req.user.id,
      order_id,
      discount_amount
    });

    // Increment usage count
    await supabase.rpc('increment_coupon_usage', { coupon_id });

    res.json({
      status: 'success',
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    console.error('Coupon usage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error applying coupon'
    });
  }
});

// @desc    Create coupon (Admin)
// @route   POST /api/coupons
// @access  Private/Admin
router.post('/', protect, authorize('admin'), couponValidation, validate, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coupons')
      .insert([{ ...req.body, code: req.body.code.toUpperCase() }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Coupon creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating coupon'
    });
  }
});

// @desc    Get all coupons (Admin)
// @route   GET /api/coupons
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching coupons'
    });
  }
});

// @desc    Update coupon (Admin)
// @route   PUT /api/coupons/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coupons')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Coupon update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating coupon'
    });
  }
});

// @desc    Delete coupon (Admin)
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Coupon deletion error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting coupon'
    });
  }
});

export default router;
