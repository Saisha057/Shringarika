-- ================================================
-- CRITICAL FIX: Add Proper Archive Columns
-- Purpose: Fix constraint violation when archiving orders
-- Root Cause: CHECK constraint blocks order_status='Archived'
-- Solution: Add separate is_archived boolean and archived_at timestamp
-- ================================================

-- STEP 1: Add archive columns if they don't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- STEP 2: Create index for fast archived orders queries
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders(archived_at) WHERE archived_at IS NOT NULL;

-- STEP 3: Update any orders that might have order_status='Archived' 
-- (will fail due to constraint, so this handles edge cases)
UPDATE orders 
SET 
  is_archived = TRUE,
  archived_at = updated_at,
  order_status = 'Delivered'
WHERE order_status = 'Archived';

-- STEP 4: OPTIONAL - Add 'Archived' to allowed statuses if you want to support it
-- Uncomment this if you prefer using order_status instead of is_archived flag
-- ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
-- ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
--   CHECK (order_status IN (
--     'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped',
--     'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded', 'Archived'
--   ));

-- STEP 5: Add comment for documentation
COMMENT ON COLUMN orders.is_archived IS 'Soft delete flag for orders older than 7 days after delivery';
COMMENT ON COLUMN orders.archived_at IS 'Timestamp when order was archived';
COMMENT ON COLUMN orders.archived_by IS 'Admin user who archived the order';

-- STEP 6: Verify the changes
DO $$
DECLARE
  has_is_archived BOOLEAN;
  has_archived_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_archived'
  ) INTO has_is_archived;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'archived_at'
  ) INTO has_archived_at;
  
  IF has_is_archived AND has_archived_at THEN
    RAISE NOTICE '✅ Archive columns added successfully';
    RAISE NOTICE '   - is_archived: %', has_is_archived;
    RAISE NOTICE '   - archived_at: %', has_archived_at;
  ELSE
    RAISE WARNING '❌ Failed to add archive columns';
  END IF;
END $$;
