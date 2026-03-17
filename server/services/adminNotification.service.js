import { getSupabaseAdmin } from '../config/supabase.js';

export const createAdminNotification = async ({ type, message, referenceId }) => {
  try {
    console.log('[AdminNotification] Creating notification:', { type, message, referenceId });
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: type,
        message: message,
        is_read: false,
        reference_id: referenceId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[AdminNotification] Insert error:', error.message, error.code, error.details, error.hint);
      return null;
    }

    console.log('[AdminNotification] Created successfully. ID:', data?.id);
    return data;
  } catch (error) {
    console.error('[AdminNotification] Unexpected error:', error.message || error);
    return null;
  }
};
