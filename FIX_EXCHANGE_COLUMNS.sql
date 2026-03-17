
-- ========================================
-- FIX: Add missing exchange and return columns to orders table
-- Issue: approveExchange function fails because columns don't exist
-- Error: "Could not find the 'exchange_approved_at' column of 'orders'"
-- ========================================

-- Add exchange tracking columns
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

-- Add return tracking columns
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

-- Add additional tracking columns for better order management
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

-- Create index for better query performance on exchange and return columns
CREATE INDEX IF NOT EXISTS idx_orders_exchange_status ON orders(exchange_status) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status) WHERE return_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_exchange_requested_at ON orders(exchange_requested_at) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_requested_at ON orders(return_requested_at) WHERE return_requested = true;

-- Add comments for documentation
COMMENT ON COLUMN orders.exchange_requested IS 'Flag indicating if customer requested an exchange';
COMMENT ON COLUMN orders.exchange_status IS 'Current status of exchange request: requested, approved, rejected, processing, completed, cancelled';
COMMENT ON COLUMN orders.exchange_request IS 'JSON object containing exchange details (reason, newSize, newColor, etc.)';
COMMENT ON COLUMN orders.exchange_approved_by IS 'Admin user ID who approved the exchange';
COMMENT ON COLUMN orders.return_requested IS 'Flag indicating if customer requested a return';
COMMENT ON COLUMN orders.return_status IS 'Current status of return request: requested, approved, rejected, processing, completed, cancelled';
COMMENT ON COLUMN orders.return_request IS 'JSON object containing return details (reasons, refundMethod, etc.)';

-- Update existing orders to have proper order_status if null
UPDATE orders 
SET order_status = COALESCE(status, 'pending')
WHERE order_status IS NULL;

-- Refresh the Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- Verification query - Run this to confirm columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name LIKE '%exchange%' OR column_name LIKE '%return%'
ORDER BY column_name;

-- ✅ SUCCESS MESSAGE
SELECT 
  '✅ Migration Complete!' as status,
  'All exchange and return columns added to orders table' as message,
  COUNT(*) as total_columns_added
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND (column_name LIKE '%exchange%' OR column_name LIKE '%return%');
