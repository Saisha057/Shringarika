import { initializeSupabase, getSupabaseAdmin } from './config/supabase.js';

async function checkAndFixOrders() {
  console.log('🔍 Checking orders table schema...\n');
  
  // Initialize Supabase first
  initializeSupabase();
  const supabase = getSupabaseAdmin();
  
  try {
    // Try to get one order to see what columns exist
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying orders:', error.message);
      console.log('\nTrying to create a test order to see exact error...\n');
      
      // Try creating a minimal order
      const testOrder = {
        order_number: 'TEST-' + Date.now(),
        user_id: null, // This will fail if NOT NULL
        subtotal: 100,
        total_amount: 100,
        shipping_address: { street: 'test' },
        billing_address: { street: 'test' }
      };
      
      const { error: insertError } = await supabase
        .from('orders')
        .insert([testOrder]);
      
      if (insertError) {
        console.error('❌ Test order creation failed:');
        console.error('   Error:', insertError.message);
        console.error('   Code:', insertError.code);
        console.error('   Details:', insertError.details);
        console.error('   Hint:', insertError.hint);
        
        if (insertError.message?.includes('null value in column "user_id"')) {
          console.log('\n🔧 FIX REQUIRED: user_id column needs to be nullable');
          console.log('   Run this SQL in Supabase Dashboard:\n');
          console.log('   ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;\n');
        }
      }
    } else {
      console.log('✅ Orders table accessible');
      if (data && data.length > 0) {
        console.log('\nExisting columns in orders table:');
        console.log(Object.keys(data[0]).join(', '));
      } else {
        console.log('   (No orders exist yet)');
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

checkAndFixOrders().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
