-- ================================================
-- 🔴 CRITICAL FIX: Proper Archive Implementation
-- ================================================
-- Purpose: Add is_archived flag instead of using order_status='Archived'
-- Reason: CHECK constraint blocks 'Archived' value in order_status
-- Impact: Fixes 500 error when archiving orders
-- ================================================

-- STEP 1: Add archive columns if they don't exist
DO $$
BEGIN
  -- Add is_archived column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ Added is_archived column';
  ELSE
    RAISE NOTICE '⚠️ is_archived column already exists';
  END IF;

  -- Add archived_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN archived_at TIMESTAMP DEFAULT NULL;
    RAISE NOTICE '✅ Added archived_at column';
  ELSE
    RAISE NOTICE '⚠️ archived_at column already exists';
  END IF;

  -- Add archived_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE orders ADD COLUMN archived_by UUID REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added archived_by column';
  ELSE
    RAISE NOTICE '⚠️ archived_by column already exists';
  END IF;
END $$;

-- STEP 2: Set default values for existing rows
UPDATE orders 
SET is_archived = FALSE 
WHERE is_archived IS NULL;

-- STEP 3: Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders(archived_at) WHERE archived_at IS NOT NULL;

-- STEP 4: Add constraints
ALTER TABLE orders 
  ALTER COLUMN is_archived SET DEFAULT FALSE,
  ALTER COLUMN is_archived SET NOT NULL;

-- STEP 5: Add comments for documentation
COMMENT ON COLUMN orders.is_archived IS 'Soft delete flag for orders older than 7 days after delivery';
COMMENT ON COLUMN orders.archived_at IS 'Timestamp when order was archived';
COMMENT ON COLUMN orders.archived_by IS 'Admin user who archived the order';

-- STEP 6: Verify the changes
DO $$
DECLARE
  has_is_archived BOOLEAN;
  has_archived_at BOOLEAN;
  has_archived_by BOOLEAN;
  order_count INTEGER;
  archived_count INTEGER;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_archived'
  ) INTO has_is_archived;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'archived_at'
  ) INTO has_archived_at;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'archived_by'
  ) INTO has_archived_by;
  
  -- Count orders
  SELECT COUNT(*) INTO order_count FROM orders;
  SELECT COUNT(*) INTO archived_count FROM orders WHERE is_archived = TRUE;
  
  -- Print results
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added:';
  RAISE NOTICE '  • is_archived: %', has_is_archived;
  RAISE NOTICE '  • archived_at: %', has_archived_at;
  RAISE NOTICE '  • archived_by: %', has_archived_by;
  RAISE NOTICE '';
  RAISE NOTICE 'Database statistics:';
  RAISE NOTICE '  • Total orders: %', order_count;
  RAISE NOTICE '  • Archived orders: %', archived_count;
  RAISE NOTICE '  • Active orders: %', order_count - archived_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Restart backend server';
  RAISE NOTICE '2. Test archive functionality in admin dashboard';
  RAISE NOTICE '3. Verify no 500 errors when archiving orders';
  RAISE NOTICE '';
  
  IF has_is_archived AND has_archived_at AND has_archived_by THEN
    RAISE NOTICE '✅ All archive columns verified successfully!';
  ELSE
    RAISE WARNING '❌ Some columns are missing - check execution logs';
  END IF;
END $$;
