-- =====================================================
-- FIX GUEST ORDERS - Allow NULL user_id
-- Issue: Orders table has user_id as NOT NULL, preventing guest checkout
-- Solution: Make user_id nullable for guest orders
-- =====================================================

-- Make user_id nullable in orders table
ALTER TABLE orders 
ALTER COLUMN user_id DROP NOT NULL;

-- Add guest_uuid column if it doesn't exist (for guest tracking)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255);

-- Add customer contact fields if they don't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);

-- Add missing fields from controller that aren't in schema
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS contact_details JSONB,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) DEFAULT 'COD',
ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT '₹',
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;

-- Add index for guest orders
CREATE INDEX IF NOT EXISTS idx_orders_guest_uuid ON orders(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Add index for order_status
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- Ensure order_items has nullable variant_id (already done in previous migration)
-- Just verify it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_items'
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE order_items ADD COLUMN image_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_items'
        AND column_name = 'variant_info'
    ) THEN
        ALTER TABLE order_items ADD COLUMN variant_info JSONB;
    END IF;
END $$;

-- Update RLS policies to allow guest orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders" ON orders
FOR SELECT USING (
    auth.uid()::text = user_id::text 
    OR guest_uuid IS NOT NULL
);

DROP POLICY IF EXISTS "Users can insert their own orders" ON orders;
CREATE POLICY "Users can insert their own orders" ON orders
FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text 
    OR user_id IS NULL  -- Allow guest orders
);

COMMENT ON COLUMN orders.user_id IS 'User ID - nullable for guest orders';
COMMENT ON COLUMN orders.guest_uuid IS 'Guest UUID for tracking guest orders';
COMMENT ON COLUMN orders.customer_name IS 'Customer name (for both auth and guest users)';
COMMENT ON COLUMN orders.customer_email IS 'Customer email (for both auth and guest users)';
COMMENT ON COLUMN orders.customer_phone IS 'Customer phone (for both auth and guest users)';
