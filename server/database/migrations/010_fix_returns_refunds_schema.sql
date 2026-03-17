-- ================================================
-- CRITICAL FIX: Add ALL missing columns to orders table
-- This fixes the schema cache errors and enables returns/exchanges
-- ================================================

-- Step 1: Add return/refund columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_request JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_by UUID REFERENCES users(id);

-- Step 2: Add refund tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_upi_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_notes TEXT;

-- Step 3: Add exchange tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_requested BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_request JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_requested_at TIMESTAMP;

-- Step 4: Add status tracking column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_return_requested ON orders(return_requested) WHERE return_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status) WHERE return_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_exchange_requested ON orders(exchange_requested) WHERE exchange_requested = true;
CREATE INDEX IF NOT EXISTS idx_orders_exchange_status ON orders(exchange_status) WHERE exchange_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON orders(refund_status) WHERE refund_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at ON orders(status_updated_at DESC);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN orders.return_requested IS 'Flag indicating if user has requested a return';
COMMENT ON COLUMN orders.return_status IS 'Status: requested, approved, rejected, completed, cancelled';
COMMENT ON COLUMN orders.return_request IS 'JSON: { reason, refundMethod, upiId, items, photos }';
COMMENT ON COLUMN orders.refund_method IS 'Method: upi, bank_transfer, original_payment, store_credit';
COMMENT ON COLUMN orders.refund_upi_id IS 'UPI ID for UPI refunds (e.g., user@bank)';
COMMENT ON COLUMN orders.exchange_requested IS 'Flag indicating if user has requested an exchange';
COMMENT ON COLUMN orders.exchange_status IS 'Status: requested, approved, rejected, completed, cancelled';
COMMENT ON COLUMN orders.exchange_details IS 'JSON: { oldItem, newItem, reason, additionalCost }';
COMMENT ON COLUMN orders.status_updated_at IS 'Last time order status was changed';

-- Step 7: Create trigger to auto-update status_updated_at
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

DROP TRIGGER IF NOT EXISTS trigger_update_order_status_timestamp ON orders;
CREATE TRIGGER trigger_update_order_status_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();

-- Step 8: Verify all columns exist
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

-- Step 9: Refresh schema cache (Supabase specific)
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE orders IS 'Updated: Added return/refund/exchange columns for complete order lifecycle management';
