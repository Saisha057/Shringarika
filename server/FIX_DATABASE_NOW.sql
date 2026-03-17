-- ===================================================================
-- CRITICAL DATABASE FIX FOR ORDER CREATION
-- Run this SQL in Supabase Dashboard SQL Editor
-- ===================================================================

-- Step 1: Make user_id nullable (CRITICAL - allows guest orders)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add missing columns that the code expects
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT '₹';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_price DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;

-- Step 3: Add image_url column to order_items if missing
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Step 4: Add constraint to ensure either user_id OR guest_uuid exists
-- Drop constraint if it exists, then add it
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_or_guest') THEN
    ALTER TABLE orders DROP CONSTRAINT chk_user_or_guest;
  END IF;
END $$;

ALTER TABLE orders ADD CONSTRAINT chk_user_or_guest 
  CHECK (user_id IS NOT NULL OR guest_uuid IS NOT NULL);

-- Step 5: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_guest_uuid ON orders(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_is_paid ON orders(is_paid);
CREATE INDEX IF NOT EXISTS idx_orders_is_delivered ON orders(is_delivered);

-- ===================================================================
-- DONE! After running this, order creation should work
-- ===================================================================
