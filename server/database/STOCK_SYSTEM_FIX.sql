-- =============================================================================
-- COMPREHENSIVE STOCK/INVENTORY SYSTEM FIX
-- =============================================================================
-- Date: January 2, 2026
-- Purpose: Fix broken stock management, implement variant-based inventory
-- Status: READY TO EXECUTE
-- 
-- IMPORTANT: Run during low-traffic period, backup data first!
-- =============================================================================

-- PHASE 1: Create product_inventory Table (Single Source of Truth)
-- =============================================================================

-- Drop existing table if corrupted (DANGEROUS - only if needed)
-- DROP TABLE IF EXISTS product_inventory CASCADE;

CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant attributes
  size VARCHAR(50),
  color VARCHAR(50),
  sku VARCHAR(100) UNIQUE,
  
  -- Stock tracking
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique size+color combination per product
  CONSTRAINT unique_product_variant UNIQUE (product_id, size, color)
);

-- Add comment
COMMENT ON TABLE product_inventory IS 'Variant-level stock tracking for products with sizes/colors';

-- Add missing columns to existing table (if table already exists)
DO $$
BEGIN
  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ Added is_active column to product_inventory';
  END IF;

  -- Add reserved_stock column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'reserved_stock'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);
    RAISE NOTICE '✅ Added reserved_stock column to product_inventory';
  END IF;

  -- Add low_stock_threshold column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
    RAISE NOTICE '✅ Added low_stock_threshold column to product_inventory';
  END IF;

  -- Add sku column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'sku'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN sku VARCHAR(100) UNIQUE;
    RAISE NOTICE '✅ Added sku column to product_inventory';
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE '✅ Added created_at column to product_inventory';
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_inventory' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE product_inventory ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE '✅ Added updated_at column to product_inventory';
  END IF;

  RAISE NOTICE '✅ All required columns verified';
END $$;

-- =============================================================================
-- PHASE 2: Create Indexes for Performance
-- =============================================================================

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id 
ON product_inventory(product_id);

-- Variant lookup index (used in stock checks)
CREATE INDEX IF NOT EXISTS idx_product_inventory_size_color 
ON product_inventory(product_id, size, color);

-- Stock availability index (used in searches)
CREATE INDEX IF NOT EXISTS idx_product_inventory_stock 
ON product_inventory(stock) 
WHERE stock > 0 AND is_active = true;

-- SKU lookup index
CREATE INDEX IF NOT EXISTS idx_product_inventory_sku 
ON product_inventory(sku) 
WHERE sku IS NOT NULL;

-- =============================================================================
-- PHASE 3: Populate Variant Records for Existing Products
-- =============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Generate variant records for all products with sizes
  INSERT INTO product_inventory (product_id, size, color, stock, sku, is_active)
  SELECT 
    p.id AS product_id,
    size_value AS size,
    COALESCE(color_value, 'default') AS color,
    -- Distribute total_stock evenly across variants
    CASE 
      WHEN p.total_stock IS NOT NULL AND p.total_stock > 0 THEN
        GREATEST(
          FLOOR(p.total_stock::numeric / NULLIF(array_length(p.sizes, 1) * COALESCE(array_length(p.colors, 1), 1), 0)),
          1
        )::integer
      ELSE 50 -- Default stock for new products
    END AS stock,
    CONCAT(
      COALESCE(p.slug, p.id::text), 
      '-', 
      LOWER(REPLACE(size_value, ' ', '')), 
      '-', 
      LOWER(REPLACE(COALESCE(color_value, 'default'), ' ', ''))
    ) AS sku,
    p.is_active AS is_active
  FROM products p
  CROSS JOIN LATERAL unnest(p.sizes) AS size_value
  CROSS JOIN LATERAL (
    SELECT unnest(COALESCE(p.colors, ARRAY['default']::text[])) AS color_value
  ) colors
  WHERE 
    p.sizes IS NOT NULL 
    AND array_length(p.sizes, 1) > 0
    -- Don't duplicate existing variants
    AND NOT EXISTS (
      SELECT 1 FROM product_inventory pi 
      WHERE pi.product_id = p.id 
        AND pi.size = size_value
        AND pi.color = COALESCE(color_value, 'default')
    )
  ON CONFLICT (product_id, size, color) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '✅ Created % new product variant records', v_count;
END $$;

-- =============================================================================
-- PHASE 4: Sync products.total_stock with Variant Stock
-- =============================================================================

-- Update product total_stock to match sum of all variant stocks
UPDATE products p
SET 
  total_stock = (
    SELECT COALESCE(SUM(pi.stock), 0)
    FROM product_inventory pi
    WHERE pi.product_id = p.id AND pi.is_active = true
  ),
  in_stock = (
    SELECT COALESCE(SUM(pi.stock), 0) > 0
    FROM product_inventory pi
    WHERE pi.product_id = p.id AND pi.is_active = true
  ),
  stock_updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id
);

-- =============================================================================
-- PHASE 5: Create Atomic Stock Deduction Function (CRITICAL)
-- =============================================================================

-- Drop ALL existing function versions (including overloaded ones)
DO $$
BEGIN
  -- Drop all versions of these functions
  DROP FUNCTION IF EXISTS deduct_stock_atomic CASCADE;
  DROP FUNCTION IF EXISTS check_stock_availability CASCADE;
  DROP FUNCTION IF EXISTS restore_stock_atomic CASCADE;
  DROP FUNCTION IF EXISTS check_low_stock_products CASCADE;
  DROP FUNCTION IF EXISTS deduct_stock_on_order CASCADE;
  DROP FUNCTION IF EXISTS restore_stock_on_cancellation CASCADE;
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error dropping functions: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION deduct_stock_atomic(
  p_product_id UUID,
  p_size VARCHAR(50),
  p_color VARCHAR(50),
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_variant_id UUID;
  v_product_name TEXT;
BEGIN
  -- Input validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid quantity: must be greater than 0',
      'requested', p_quantity
    );
  END IF;

  -- Lock the row for update (prevents race conditions)
  -- This is CRITICAL for preventing overselling
  SELECT pi.id, pi.stock, p.name
  INTO v_variant_id, v_current_stock, v_product_name
  FROM product_inventory pi
  JOIN products p ON p.id = pi.product_id
  WHERE pi.product_id = p_product_id
    AND pi.size = p_size
    AND COALESCE(pi.color, 'default') = COALESCE(p_color, 'default')
    AND pi.is_active = true
  FOR UPDATE; -- ← CRITICAL: Row-level lock, prevents concurrent modifications

  -- Check if variant exists
  IF v_variant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found',
      'product_id', p_product_id,
      'size', p_size,
      'color', COALESCE(p_color, 'default')
    );
  END IF;

  -- Check if sufficient stock
  IF v_current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'product_name', v_product_name,
      'size', p_size,
      'color', COALESCE(p_color, 'default'),
      'available', v_current_stock,
      'requested', p_quantity
    );
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock - p_quantity;

  -- Deduct stock atomically
  UPDATE product_inventory
  SET 
    stock = v_new_stock,
    updated_at = NOW()
  WHERE id = v_variant_id;

  -- Update product total_stock for consistency
  UPDATE products
  SET 
    total_stock = (
      SELECT COALESCE(SUM(stock), 0)
      FROM product_inventory
      WHERE product_id = p_product_id AND is_active = true
    ),
    in_stock = (
      SELECT COALESCE(SUM(stock), 0) > 0
      FROM product_inventory
      WHERE product_id = p_product_id AND is_active = true
    ),
    stock_updated_at = NOW()
  WHERE id = p_product_id;

  -- Log success
  RAISE NOTICE '✅ Stock deducted: Product=%, Size=%, % → %', 
    v_product_name, p_size, v_current_stock, v_new_stock;

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'variant_id', v_variant_id,
    'product_name', v_product_name,
    'size', p_size,
    'color', COALESCE(p_color, 'default'),
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'deducted', p_quantity,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION deduct_stock_atomic IS 'Transaction-safe stock deduction with row-level locking to prevent overselling';

-- =============================================================================
-- PHASE 6: Create Stock Availability Check Function
-- =============================================================================

CREATE OR REPLACE FUNCTION check_stock_availability(
  p_product_id UUID,
  p_size VARCHAR(50),
  p_color VARCHAR(50),
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INTEGER;
  v_variant_id UUID;
  v_product_name TEXT;
BEGIN
  -- Input validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'exists', false,
      'in_stock', false,
      'error', 'Invalid quantity',
      'requested', p_quantity
    );
  END IF;

  -- Check stock (no lock needed, just read)
  SELECT pi.id, pi.stock, p.name
  INTO v_variant_id, v_current_stock, v_product_name
  FROM product_inventory pi
  JOIN products p ON p.id = pi.product_id
  WHERE pi.product_id = p_product_id
    AND pi.size = p_size
    AND COALESCE(pi.color, 'default') = COALESCE(p_color, 'default')
    AND pi.is_active = true;

  -- Variant doesn't exist
  IF v_variant_id IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'in_stock', false,
      'available', 0,
      'requested', p_quantity,
      'error', 'Variant not found'
    );
  END IF;

  -- Return stock status
  RETURN jsonb_build_object(
    'exists', true,
    'in_stock', v_current_stock >= p_quantity,
    'available', v_current_stock,
    'requested', p_quantity,
    'product_name', v_product_name,
    'size', p_size,
    'color', COALESCE(p_color, 'default'),
    'low_stock', v_current_stock <= (SELECT low_stock_threshold FROM product_inventory WHERE id = v_variant_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION check_stock_availability IS 'Check if sufficient stock is available for a product variant';

-- =============================================================================
-- PHASE 7: Create Stock Restoration Function (For Cancellations)
-- =============================================================================

CREATE OR REPLACE FUNCTION restore_stock_atomic(
  p_product_id UUID,
  p_size VARCHAR(50),
  p_color VARCHAR(50),
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_variant_id UUID;
BEGIN
  -- Lock and update
  SELECT id, stock INTO v_variant_id, v_current_stock
  FROM product_inventory
  WHERE product_id = p_product_id
    AND size = p_size
    AND COALESCE(color, 'default') = COALESCE(p_color, 'default')
  FOR UPDATE;

  IF v_variant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;

  v_new_stock := v_current_stock + p_quantity;

  -- Restore stock
  UPDATE product_inventory
  SET stock = v_new_stock, updated_at = NOW()
  WHERE id = v_variant_id;

  -- Update product totals
  UPDATE products
  SET 
    total_stock = (SELECT COALESCE(SUM(stock), 0) FROM product_inventory WHERE product_id = p_product_id),
    in_stock = true,
    stock_updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'restored', p_quantity
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PHASE 8: Create Trigger to Sync product_inventory → products
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- When product_inventory changes, update products.total_stock
  UPDATE products
  SET 
    total_stock = (
      SELECT COALESCE(SUM(stock), 0)
      FROM product_inventory
      WHERE product_id = NEW.product_id AND is_active = true
    ),
    in_stock = (
      SELECT COALESCE(SUM(stock), 0) > 0
      FROM product_inventory
      WHERE product_id = NEW.product_id AND is_active = true
    ),
    stock_updated_at = NOW()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_product_stock ON product_inventory;
CREATE TRIGGER trigger_sync_product_stock
  AFTER INSERT OR UPDATE OF stock OR DELETE
  ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_total_stock();

-- =============================================================================
-- PHASE 9: Add Low Stock Alert Function
-- =============================================================================

CREATE OR REPLACE FUNCTION check_low_stock_products()
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  size VARCHAR(50),
  color VARCHAR(50),
  current_stock INTEGER,
  threshold INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    pi.size,
    pi.color,
    pi.stock,
    pi.low_stock_threshold
  FROM product_inventory pi
  JOIN products p ON p.id = pi.product_id
  WHERE pi.stock <= pi.low_stock_threshold
    AND pi.is_active = true
    AND p.is_active = true
  ORDER BY pi.stock ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PHASE 10: Enable Row Level Security (RLS) on product_inventory
-- =============================================================================

ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Public can read active inventory
CREATE POLICY "Anyone can view active product inventory"
ON product_inventory FOR SELECT
TO public
USING (is_active = true);

-- Only admins can modify inventory
CREATE POLICY "Only admins can modify inventory"
ON product_inventory FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- =============================================================================
-- PHASE 11: Data Validation & Cleanup
-- =============================================================================

-- Check for negative stock (should not exist)
DO $$
DECLARE
  v_negative_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_negative_count
  FROM product_inventory
  WHERE stock < 0;
  
  IF v_negative_count > 0 THEN
    RAISE WARNING '⚠️ Found % records with negative stock! Fixing...', v_negative_count;
    
    -- Fix negative stock
    UPDATE product_inventory
    SET stock = 0
    WHERE stock < 0;
    
    RAISE NOTICE '✅ Fixed negative stock values';
  ELSE
    RAISE NOTICE '✅ No negative stock found';
  END IF;
END $$;

-- Verify all products have variants
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM products p
  WHERE p.sizes IS NOT NULL 
    AND array_length(p.sizes, 1) > 0
    AND NOT EXISTS (
      SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id
    );
  
  IF v_missing_count > 0 THEN
    RAISE WARNING '⚠️ Found % products without inventory records', v_missing_count;
  ELSE
    RAISE NOTICE '✅ All products have inventory records';
  END IF;
END $$;

-- =============================================================================
-- PHASE 12: Grant Permissions
-- =============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION check_stock_availability TO authenticated, anon;
GRANT EXECUTE ON FUNCTION deduct_stock_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION restore_stock_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION check_low_stock_products TO authenticated;

-- =============================================================================
-- EXECUTION SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ STOCK SYSTEM FIX COMPLETED SUCCESSFULLY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  ✅ Created product_inventory table';
  RAISE NOTICE '  ✅ Created indexes for performance';
  RAISE NOTICE '  ✅ Populated variant records';
  RAISE NOTICE '  ✅ Created atomic stock deduction function';
  RAISE NOTICE '  ✅ Created stock availability check function';
  RAISE NOTICE '  ✅ Created stock restoration function';
  RAISE NOTICE '  ✅ Created automatic sync trigger';
  RAISE NOTICE '  ✅ Enabled RLS policies';
  RAISE NOTICE '  ✅ Validated data integrity';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verification Queries:';
  RAISE NOTICE '  SELECT * FROM product_inventory LIMIT 10;';
  RAISE NOTICE '  SELECT * FROM check_low_stock_products();';
  RAISE NOTICE '  SELECT check_stock_availability(''<product_id>'', ''M'', ''Red'', 1);';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Next Steps:';
  RAISE NOTICE '  1. Update order.controller.js to use new functions';
  RAISE NOTICE '  2. Update frontend to enable real-time subscriptions';
  RAISE NOTICE '  3. Test order placement with stock deduction';
  RAISE NOTICE '  4. Test concurrent order scenarios';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
