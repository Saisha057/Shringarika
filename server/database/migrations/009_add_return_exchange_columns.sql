-- Add return and exchange related columns to orders table
-- Run this in Supabase SQL Editor

-- Add return_status column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status VARCHAR(50);

-- Add return_request column (JSONB to store return details)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_request JSONB;

-- Add return approval tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_by UUID REFERENCES users(id);

-- Add refund tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_notes TEXT;

-- Add exchange_status column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_status VARCHAR(50);

-- Add exchange_request column (JSONB to store exchange details)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_request JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);
CREATE INDEX IF NOT EXISTS idx_orders_exchange_status ON orders(exchange_status);

-- Add comments for documentation
COMMENT ON COLUMN orders.return_status IS 'Status of return request: requested, approved, rejected, completed';
COMMENT ON COLUMN orders.return_request IS 'JSON containing return reasons, refund method, and other details';
COMMENT ON COLUMN orders.exchange_status IS 'Status of exchange request: requested, approved, rejected, completed';
COMMENT ON COLUMN orders.exchange_request IS 'JSON containing exchange item details, new size/color, and reason';

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('return_status', 'return_request', 'exchange_status', 'exchange_request', 'refund_amount');
