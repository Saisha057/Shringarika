-- Fix Orders Table Schema for Guest Orders
-- This migration makes user_id nullable to support guest checkouts

-- Step 1: Make user_id nullable
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add missing columns that the code expects
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

-- Step 3: Add missing column to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Step 4: Create index for guest orders
CREATE INDEX IF NOT EXISTS idx_orders_guest_uuid ON orders(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- Step 5: Add constraint for guest or user order
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_user_or_guest;
ALTER TABLE orders ADD CONSTRAINT chk_user_or_guest 
  CHECK (user_id IS NOT NULL OR guest_uuid IS NOT NULL);

COMMENT ON TABLE orders IS 'Orders table supporting both authenticated users and guest checkouts';
