import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// GET /api/orders/:orderId/timeline
router.get('/:orderId/timeline', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const supabase = getSupabaseAdmin();

    // User can only read own order timeline; admin can read any.
    if (req.user?.role !== 'admin') {
      const { data: orderRow, error: orderErr } = await supabase
        .from('orders')
        .select('id, user_id')
        .eq('id', orderId)
        .single();

      if (orderErr || !orderRow) {
        return res.status(404).json({ status: 'error', message: 'Order not found' });
      }

      if (orderRow.user_id !== req.user?.id) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
    }

    const { data: events, error } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    return res.status(200).json({
      status: 'success',
      data: { events: events || [] },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
