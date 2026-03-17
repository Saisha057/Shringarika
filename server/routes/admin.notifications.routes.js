import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// GET /api/admin/notifications
router.get('/notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Notifications fetch error:', error.message);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    console.log('Notifications fetched:', data?.length);
    return res.status(200).json({
      status: 'success',
      notifications: data || [],
      data: { notifications: data || [] }
    });
  } catch (error) {
    console.error('Notifications fetch error:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/admin/notifications/test-insert
router.get('/notifications/test-insert', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: 'TEST',
        message: 'Test notification - verify insert works',
        is_read: false,
        reference_id: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      });
    }

    return res.json({
      success: true,
      message: 'Notification inserted successfully',
      id: data?.id,
    });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});

// GET /api/admin/test-notification-insert (alias for diagnostics)
router.get('/test-notification-insert', protect, authorize('admin'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: 'TEST_INSERT',
        message: 'Diagnostic test - verifying insert works at ' + new Date().toISOString(),
        is_read: false,
        reference_id: null,
      })
      .select()
      .single();

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      });
    }

    return res.json({
      success: true,
      inserted_id: data?.id,
      message: 'Insert works correctly',
    });
  } catch (err) {
    return res.json({ success: false, exception: err.message });
  }
});

// PUT /api/admin/notifications/:notificationId/read
router.put('/notifications/:notificationId/read', protect, authorize('admin'), async (req, res) => {
  try {
    const { notificationId } = req.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    return res.status(200).json({ status: 'success', data: { notification: data } });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
