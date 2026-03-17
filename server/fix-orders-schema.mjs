import { getSupabaseAdmin } from '../config/supabase.js';

async function fixOrdersSchema() {
  console.log('🔧 Fixing orders table schema for guest checkouts...\n');
  
  const supabase = getSupabaseAdmin();
  
  try {
    // Check current schema
    console.log('1. Checking current orders table...');
    const { data: currentOrders, error: checkError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.log('   ⚠️  Orders table check:', checkError.message);
    } else {
      console.log('   ✅ Orders table exists');
    }

    // The main fix: Alter columns directly via SQL (requires superuser access)
    // Since we can't run ALTER statements directly, we'll document what needs to be done
    console.log('\n2. Schema fixes needed:\n');
    console.log('   Run these SQL commands in Supabase SQL Editor:\n');
    
    console.log(`
-- Fix 1: Make user_id nullable for guest orders
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Fix 2: Add missing columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT '₹';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_price DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2);

-- Fix 3: Add missing column to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Fix 4: Add constraint for guest or user order
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_user_or_guest;
ALTER TABLE orders ADD CONSTRAINT chk_user_or_guest 
  CHECK (user_id IS NOT NULL OR guest_uuid IS NOT NULL);

-- Fix 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_guest_uuid ON orders(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
`);

    console.log('\n✅ Please run the above SQL in Supabase Dashboard > SQL Editor');
    console.log('   URL: https://supabase.com/dashboard/project/[your-project]/editor\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixOrdersSchema().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
