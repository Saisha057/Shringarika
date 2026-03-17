-- ========================================
-- EXCHANGE APPROVAL SCHEMA FIX
-- Purpose: Add missing exchange columns to orders table
-- Run this in Supabase SQL Editor
-- ========================================

-- 1. Add all exchange tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS exchange_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exchange_status VARCHAR(50) CHECK (exchange_status IN ('requested', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS exchange_request JSONB,
ADD COLUMN IF NOT EXISTS exchange_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exchange_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exchange_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exchange_rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exchange_rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exchange_notes TEXT,
ADD COLUMN IF NOT EXISTS exchange_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Add return tracking columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS return_status VARCHAR(50) CHECK (return_status IN ('requested', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS return_request JSONB,
ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS return_rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS return_notes TEXT,
ADD COLUMN IF NOT EXISTS return_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_return BOOLEAN DEFAULT false;

-- 3. Add missing customer and payment tracking columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_status VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_exchange_status ON orders(exchange_status) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status) WHERE return_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_exchange_requested_at ON orders(exchange_requested_at) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_requested_at ON orders(return_requested_at) WHERE return_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders(is_archived) WHERE is_archived = false;

-- 5. Add helpful comments
COMMENT ON COLUMN orders.exchange_requested IS 'Flag indicating if customer requested an exchange';
COMMENT ON COLUMN orders.exchange_status IS 'Current status of exchange request';
COMMENT ON COLUMN orders.exchange_approved_by IS 'Admin user ID who approved the exchange';
COMMENT ON COLUMN orders.return_requested IS 'Flag indicating if customer requested a return';
COMMENT ON COLUMN orders.return_status IS 'Current status of return request';

-- 6. Update existing orders with proper status
UPDATE orders 
SET order_status = COALESCE(status, 'pending')
WHERE order_status IS NULL;

-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check that all exchange columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND (
    column_name LIKE '%exchange%' OR 
    column_name LIKE '%return%'
  )
ORDER BY column_name;

-- Count total columns added
SELECT 
  COUNT(*) as exchange_columns_count
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name LIKE '%exchange%';

-- Show sample exchange data structure
SELECT 
  id,
  order_number,
  exchange_requested,
  exchange_status,
  exchange_requested_at,
  exchange_approved_at
FROM orders
WHERE exchange_requested = true
LIMIT 5;

-- ✅ SUCCESS MESSAGE
SELECT 
  '✅ Exchange Schema Migration Complete!' as status,
  'All columns added to orders table' as message,
  'Exchange approval should now work' as next_step;
