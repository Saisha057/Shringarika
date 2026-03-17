-- ============================================
-- CRITICAL FIX: Order Status Constraint
-- Purpose: Fix "orders_status_check" violation error
-- Date: December 22, 2025
-- ============================================

-- STEP 1: Drop all existing status-related constraints
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

-- STEP 2: Recreate constraint with ALL valid statuses
-- These are the ONLY statuses allowed in the system
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

-- STEP 3: Add fallback status column update (for backward compatibility)
-- Update the 'status' column to match 'order_status' for consistency
UPDATE orders 
SET status = order_status 
WHERE status IS NULL OR status = '';

-- STEP 4: Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_orders_order_status_fast ON orders(order_status);

-- STEP 5: Add trigger to sync status columns
CREATE OR REPLACE FUNCTION sync_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync 'status' with 'order_status' for backward compatibility
  NEW.status := NEW.order_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_order_status ON orders;
CREATE TRIGGER trigger_sync_order_status
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_status();

-- STEP 6: Verify constraint is working
DO $$
BEGIN
  RAISE NOTICE '✅ Order status constraint updated successfully';
  RAISE NOTICE '📋 Allowed statuses: Pending, Confirmed, Processing, Packed, Shipped, Out for Delivery, Delivered, Cancelled, Returned, Refunded';
END $$;
