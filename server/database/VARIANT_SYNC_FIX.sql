-- =============================================================================
-- COMPREHENSIVE VARIANT STOCK SYNCHRONIZATION FIX
-- =============================================================================
-- Date: January 10, 2026
-- Purpose: Ensure variant stock updates reflect everywhere in real-time
-- =============================================================================

-- STEP 1: Verify product_inventory table has all required columns
-- =============================================================================

DO $$
BEGIN
  -- Ensure stock column exists with proper constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'stock'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Add CHECK constraint to prevent negative stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'product_inventory' AND constraint_name = 'product_inventory_stock_check'
  ) THEN
    ALTER TABLE product_inventory ADD CONSTRAINT product_inventory_stock_check CHECK (stock >= 0);
  END IF;

  RAISE NOTICE '✅ Stock column verified with non-negative constraint';
END $$;

-- STEP 2: Add function to get available colors for a product
-- =============================================================================

CREATE OR REPLACE FUNCTION get_product_colors(p_product_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(DISTINCT color ORDER BY color)
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true
    AND color IS NOT NULL;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_product_colors IS 'Get all unique colors for a product from inventory';

-- STEP 3: Add function to get available sizes for a product
-- =============================================================================

CREATE OR REPLACE FUNCTION get_product_sizes(p_product_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(DISTINCT size ORDER BY size)
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true
    AND size IS NOT NULL;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_product_sizes IS 'Get all unique sizes for a product from inventory';

-- STEP 4: Add function to calculate total stock for a product
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_total_stock(p_product_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(stock), 0)::INTEGER
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION calculate_total_stock IS 'Calculate total stock across all variants';

-- STEP 5: Add function to reduce stock (for orders)
-- =============================================================================

CREATE OR REPLACE FUNCTION reduce_variant_stock(
  p_product_id UUID,
  p_size VARCHAR(50),
  p_color VARCHAR(50),
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Get current stock with row lock
  SELECT stock INTO v_current_stock
  FROM product_inventory
  WHERE product_id = p_product_id
    AND size = p_size
    AND (color = p_color OR (color IS NULL AND p_color IS NULL))
    AND is_active = true
  FOR UPDATE;

  -- Check if variant exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found: product_id=%, size=%, color=%', p_product_id, p_size, p_color;
  END IF;

  -- Check if sufficient stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: requested=%, available=%', p_quantity, v_current_stock;
  END IF;

  -- Reduce stock
  UPDATE product_inventory
  SET 
    stock = stock - p_quantity,
    updated_at = NOW()
  WHERE product_id = p_product_id
    AND size = p_size
    AND (color = p_color OR (color IS NULL AND p_color IS NULL))
    AND is_active = true;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reduce_variant_stock IS 'Safely reduce variant stock with transaction safety';

-- STEP 6: Add trigger to update products.total_stock automatically
-- =============================================================================

CREATE OR REPLACE FUNCTION update_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_stock in products table
  UPDATE products
  SET total_stock = (
    SELECT COALESCE(SUM(stock), 0)
    FROM product_inventory
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND is_active = true
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_product_total_stock ON product_inventory;

-- Create trigger on INSERT, UPDATE, DELETE
CREATE TRIGGER sync_product_total_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_stock();

COMMENT ON TRIGGER sync_product_total_stock ON product_inventory IS 'Auto-sync total_stock in products table';

-- STEP 7: Ensure RLS policies allow public read for active variants
-- =============================================================================

-- Enable RLS if not already enabled
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow public to read active variants" ON product_inventory;
DROP POLICY IF EXISTS "Allow authenticated users to read variants" ON product_inventory;
DROP POLICY IF EXISTS "Allow admins to manage variants" ON product_inventory;

-- Policy: Allow public (anon) to read active variants
CREATE POLICY "Public can read active variants"
  ON product_inventory
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Policy: Allow admins to manage all variants
CREATE POLICY "Admins can manage variants"
  ON product_inventory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- STEP 8: Add indexes for performance
-- =============================================================================

-- Index for fast variant lookup by product and size/color
CREATE INDEX IF NOT EXISTS idx_inventory_product_variant
  ON product_inventory(product_id, size, color)
  WHERE is_active = true;

-- Index for low stock queries
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
  ON product_inventory(product_id, stock)
  WHERE is_active = true AND stock <= 10;

-- STEP 9: Verify setup
-- =============================================================================

DO $$
DECLARE
  function_count INTEGER;
  trigger_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('get_product_colors', 'get_product_sizes', 'calculate_total_stock', 'reduce_variant_stock');

  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname = 'sync_product_total_stock';

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'product_inventory';

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VARIANT SYNC DATABASE FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Functions created: %', function_count;
  RAISE NOTICE 'Triggers created: %', trigger_count;
  RAISE NOTICE 'RLS policies: %', policy_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 Database ready for real-time sync';
  RAISE NOTICE '========================================';
END $$;
