import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// GET /api/admin/returns
router.get('/returns', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('returns')
      .select(`
        *,
        orders!inner(
          id,
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          user_id,
          order_events(event_type, description, created_at)
        ),
        users(name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    const enriched = (data || []).map((ret) => {
      const firstItem = Array.isArray(ret.return_items) ? ret.return_items[0] : null;
      return {
        ...ret,
        customer_name: ret.orders?.customer_name || ret.users?.name || 'Guest User',
        customer_email: ret.orders?.customer_email || ret.users?.email || 'N/A',
        variant_info: {
          original_size: firstItem?.original_size || null,
          original_color: firstItem?.original_color || null,
          new_size: firstItem?.new_size || null,
          new_color: firstItem?.new_color || null,
        },
        timeline: ret.orders?.order_events || [],
      };
    });

    return res.status(200).json({ status: 'success', data: { returns: enriched } });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
