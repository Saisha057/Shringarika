import { supabase, supabaseAdmin } from '../config/supabase.js';

export const Order = {
  async create(orderData) {
    // Extract order_items before inserting order
    const orderItems = orderData.order_items || [];
    const orderDataWithoutItems = { ...orderData };
    delete orderDataWithoutItems.order_items;

    console.log('📝 [ORDER MODEL] Creating order with', orderItems.length, 'items');

    // Insert order first
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([orderDataWithoutItems])
      .select()
      .single();
    
    if (orderError) {
      console.error('❌ [ORDER MODEL] Failed to create order:', orderError);
      throw orderError;
    }

    console.log('✅ [ORDER MODEL] Order created with ID:', order.id);

    // Insert order_items separately if they exist
    if (orderItems.length > 0) {
      const itemsToInsert = orderItems.map((item, index) => {
        console.log(`📦 [ORDER MODEL] Preparing item ${index + 1}:`, {
          productId: item.productId,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          productName: item.productName || item.name
        });

        return {
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variant?.id || null, // Now nullable after migration
          quantity: item.quantity,
          unit_price: item.pricePerItem || item.price,
          total_price: item.lineTotal || (item.pricePerItem || item.price) * item.quantity,
          product_name: item.productName || item.name,
          image_url: item.image || null,  // ✅ Store image snapshot
          variant_info: item.variant ? JSON.stringify({
            size: item.variant.size,
            color: item.variant.color || null
          }) : null  // ✅ Store variant details for stock matching
        };
      });

      console.log('💾 [ORDER MODEL] Inserting', itemsToInsert.length, 'order items...');

      const { data: insertedItems, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert)
        .select();
      
      if (itemsError) {
        console.error('❌ [ORDER MODEL] Failed to insert order_items:', itemsError);
        console.error('❌ [ORDER MODEL] Error details:', {
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          code: itemsError.code
        });
        console.error('❌ [ORDER MODEL] Attempted to insert:', JSON.stringify(itemsToInsert, null, 2));
        
        // Rollback order if items fail
        console.log('🔄 [ORDER MODEL] Rolling back order...');
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        
        throw new Error('Failed to create order items: ' + itemsError.message);
      }

      console.log('✅ [ORDER MODEL] Successfully inserted', insertedItems?.length || 0, 'order items');
    } else {
      console.log('⚠️  [ORDER MODEL] No order items to insert');
    }

    return order;
  },
  async findById(id) {
    const { data, error } = await supabaseAdmin.from('orders').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async findByUserId(userId) {
    // ✅ FIX: Include order_items with product details and images
    // Using supabaseAdmin because RLS policies expect Supabase Auth tokens, not JWT
    // Security is enforced at controller level via req.user.id
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          image_url,
          products (
            id,
            name,
            images
          )
        )
      `)
      .or(`user_id.eq.${userId},guest_uuid.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Fetch variant details separately if variant_id exists
    if (data && data.length > 0) {
      for (const order of data) {
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            if (item.variant_id) {
              const { data: variant } = await supabaseAdmin
                .from('product_variants')
                .select('id, size, color')
                .eq('id', item.variant_id)
                .single();
              if (variant) {
                item.product_variants = variant;
              }
            }
          }
        }
      }
    }
    
    return data || [];
  },
  async findAll() {
    // ✅ FIX: Fetch ALL orders with order_items, product details, and proper ordering
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          image_url,
          products (
            id,
            name,
            images
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Fetch variant details separately if variant_id exists
    if (data && data.length > 0) {
      for (const order of data) {
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            if (item.variant_id) {
              const { data: variant } = await supabaseAdmin
                .from('product_variants')
                .select('id, size, color')
                .eq('id', item.variant_id)
                .single();
              if (variant) {
                item.product_variants = variant;
              }
            }
          }
        }
      }
    }
    
    return data || [];
  },
  async update(id, updates) {
    const { data, error } = await supabaseAdmin.from('orders').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async updateStatus(id, status) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async deleteById(id) {
    const { error } = await supabaseAdmin.from('orders').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
export default Order;
