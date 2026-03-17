-- ================================================
-- COMPLETE FIX: Order Status + Returns/Refunds Schema
-- Fixes both constraint violations and adds missing columns
-- Run this INSTEAD of the separate migrations
-- ================================================

-- ================================================
-- PART 1: DROP ALL STATUS CONSTRAINTS FIRST
-- ================================================

-- Drop ALL existing status constraints BEFORE updating data
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS order_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_order_status;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS status_check;

-- ================================================
-- PART 2: FIX EXISTING DATA (Now safe to update)
-- ================================================

-- Update order_status column - fix invalid values
UPDATE orders 
SET order_status = 'Pending'
WHERE order_status IS NULL 
   OR order_status = ''
   OR order_status NOT IN (
    'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped',
    'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'
);

-- Update status column to match order_status
UPDATE orders 
SET status = COALESCE(order_status, 'Pending')
WHERE status IS NULL 
   OR status = ''
   OR status != order_status;

-- ================================================
-- PART 3: ADD NEW CONSTRAINTS WITH ALL VALID STATUSES
-- ================================================

-- Add constraint for order_status column
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN (
    'Pending',
    'Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Returned',
    'Refunded'
  ));

-- Add constraint for status column (for backward compatibility)
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'Pending',
    'Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Returned',
    'Refunded'
  ));

-- ================================================
-- PART 4: ADD RETURN/REFUND/EXCHANGE COLUMNS
-- ================================================

-- Return columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_request JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_by UUID;

-- Refund columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_upi_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_notes TEXT;

-- Exchange columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_requested BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_request JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_requested_at TIMESTAMP;

-- Status tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ================================================
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_orders_order_status_fast ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_return_requested ON orders(return_requested) WHERE return_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status) WHERE return_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_exchange_requested ON orders(exchange_requested) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_exchange_status ON orders(exchange_status) WHERE exchange_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON orders(refund_status) WHERE refund_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at ON orders(status_updated_at DESC);

-- ================================================
-- PART 6: CREATE TRIGGERS
-- ================================================

-- Trigger to sync status columns
CREATE OR REPLACE FUNCTION sync_order_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := NEW.order_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_order_status ON orders;
CREATE TRIGGER trigger_sync_order_status
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_status();

-- Trigger to auto-update status_updated_at
CREATE OR REPLACE FUNCTION update_order_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.order_status IS DISTINCT FROM NEW.order_status OR 
     OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_status_timestamp ON orders;
CREATE TRIGGER trigger_update_order_status_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();

-- ================================================
-- PART 7: ADD COLUMN COMMENTS
-- ================================================

COMMENT ON COLUMN orders.return_requested IS 'Flag indicating if user has requested a return';
COMMENT ON COLUMN orders.return_status IS 'Status: requested, approved, rejected, completed, cancelled';
COMMENT ON COLUMN orders.return_request IS 'JSON: { reason, refundMethod, upiId, items, photos }';
COMMENT ON COLUMN orders.refund_method IS 'Method: upi, bank_transfer, original_payment, store_credit';
COMMENT ON COLUMN orders.refund_upi_id IS 'UPI ID for UPI refunds (e.g., user@bank)';
COMMENT ON COLUMN orders.exchange_requested IS 'Flag indicating if user has requested an exchange';
COMMENT ON COLUMN orders.exchange_status IS 'Status: requested, approved, rejected, completed, cancelled';
COMMENT ON COLUMN orders.exchange_details IS 'JSON: { oldItem, newItem, reason, additionalCost }';
COMMENT ON COLUMN orders.status_updated_at IS 'Last time order status was changed';
COMMENT ON TABLE orders IS 'Orders table with complete return/refund/exchange support';

-- ================================================
-- PART 8: VERIFY INSTALLATION
-- ================================================

-- Check all new columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN (
  'return_requested', 'return_status', 'return_request', 'return_requested_at',
  'refund_method', 'refund_upi_id', 'refund_amount', 'refund_status',
  'exchange_requested', 'exchange_status', 'exchange_details',
  'status_updated_at'
)
ORDER BY column_name;

-- Verify constraint exists
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
AND conname LIKE '%status%';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✅ COMPLETE! All fixes applied successfully:';
  RAISE NOTICE '   1. Fixed existing invalid order statuses';
  RAISE NOTICE '   2. Updated order_status_check constraint';
  RAISE NOTICE '   3. Added return/refund/exchange columns';
  RAISE NOTICE '   4. Created indexes for performance';
  RAISE NOTICE '   5. Created triggers for auto-updates';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Allowed statuses: Pending, Confirmed, Processing, Packed, Shipped, Out for Delivery, Delivered, Cancelled, Returned, Refunded';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your admin can now update order statuses without errors!';
END $$;
