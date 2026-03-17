import { getSupabaseAdmin } from '../config/supabase.js';

export const logOrderEvent = async ({ orderId, userId, type, description }) => {
  try {
    if (!orderId) {
      console.warn('logOrderEvent skipped: orderId is required by order_events schema');
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('order_events')
      .insert([
        {
          order_id: orderId,
          user_id: userId || null,
          event_type: type,
          description: description || null,
        },
      ]);

    if (error) {
      console.error('logOrderEvent insert error:', error.message || error);
    }
  } catch (error) {
    console.error('logOrderEvent error:', error.message || error);
  }
};
