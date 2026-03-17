-- ============================================================================
-- COMPREHENSIVE DATABASE FIX SCRIPT - SHRINGARIKA E-COMMERCE
-- ============================================================================
-- This script addresses P0-001, P0-005, and P0-006 from QA Audit Report
-- Execute this ENTIRE file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD SAMPLE PRODUCTS (P0-001)
-- ============================================================================
-- This fixes the empty products table issue

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STEP 1: Adding sample products...';
  RAISE NOTICE '============================================';
END $$;

-- Check if products already exist
DO $$
DECLARE
  product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  
  IF product_count > 0 THEN
    RAISE NOTICE '✅ Products already exist (%), skipping insertion', product_count;
  ELSE
    RAISE NOTICE '📦 No products found, inserting sample products...';
    
    -- Insert 5 sample products
    INSERT INTO products (
      name, 
      description, 
      price, 
      category, 
      images, 
      colors, 
      sizes, 
      total_stock, 
      is_active,
      slug,
      created_at
    )
    VALUES
      (
        'Elegant Silk Saree',
        'Beautiful handwoven silk saree with traditional patterns. Perfect for weddings and special occasions.',
        3999.00,
        'SAREES',
        ARRAY['https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500'],
        ARRAY['Red', 'Blue', 'Green', 'Pink'],
        ARRAY['Free Size'],
        200,
        true,
        'elegant-silk-saree',
        NOW()
      ),
      (
        'Designer Kurti Set',
        'Trendy designer kurti with matching dupatta. Comfortable and stylish for everyday wear.',
        1299.00,
        'STITCHED KURTI',
        ARRAY['https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=500'],
        ARRAY['Pink', 'Yellow', 'White', 'Sky Blue'],
        ARRAY['S', 'M', 'L', 'XL', 'XXL'],
        300,
        true,
        'designer-kurti-set',
        NOW()
      ),
      (
        'Pure Georgette Lehenga',
        'Exquisite georgette lehenga for special occasions. Intricate embroidery work.',
        8999.00,
        'LEHENGAS',
        ARRAY['https://images.unsplash.com/photo-1595777216218-53d8c960be54?w=500'],
        ARRAY['Maroon', 'Gold', 'Royal Blue'],
        ARRAY['S', 'M', 'L'],
        150,
        true,
        'pure-georgette-lehenga',
        NOW()
      ),
      (
        'Cotton Anarkali Suit',
        'Comfortable cotton anarkali suit with beautiful prints. Perfect for casual outings.',
        1799.00,
        'UNSTITCHED SUIT',
        ARRAY['https://images.unsplash.com/photo-1619779041139-c88b30b7a0de?w=500'],
        ARRAY['Green', 'Orange', 'Purple'],
        ARRAY['S', 'M', 'L', 'XL'],
        250,
        true,
        'cotton-anarkali-suit',
        NOW()
      ),
      (
        'Banarasi Silk Dupatta',
        'Authentic Banarasi silk dupatta with zari work. Adds elegance to any outfit.',
        2499.00,
        'DUPPATTAS',
        ARRAY['https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=500'],
        ARRAY['Gold', 'Silver', 'Copper'],
        ARRAY['Free Size'],
        180,
        true,
        'banarasi-silk-dupatta',
        NOW()
      )
    ON CONFLICT (slug) DO NOTHING;
    
    RAISE NOTICE '✅ Sample products inserted successfully!';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: POPULATE PRODUCT_INVENTORY TABLE (P0-006)
-- ============================================================================
-- This creates variant entries for all size/color combinations

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STEP 2: Populating product_inventory...';
  RAISE NOTICE '============================================';
END $$;

-- Check if product_inventory already has data
DO $$
DECLARE
  inventory_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inventory_count FROM product_inventory;
  
  IF inventory_count > 0 THEN
    RAISE NOTICE '✅ Product inventory already populated (% entries), skipping', inventory_count;
  ELSE
    RAISE NOTICE '📦 Product inventory empty, creating variants...';
    
    -- Create variant entries for all size + color combinations
    INSERT INTO product_inventory (product_id, size, color, stock, is_active)
    SELECT 
      p.id AS product_id,
      size,
      color,
      -- Distribute total stock evenly across variants
      GREATEST(5, FLOOR(p.total_stock / (array_length(p.sizes, 1) * array_length(p.colors, 1)))) AS stock,
      true AS is_active
    FROM products p
    CROSS JOIN LATERAL unnest(p.sizes) AS size
    CROSS JOIN LATERAL unnest(p.colors) AS color
    WHERE p.is_active = true
    ON CONFLICT (product_id, size, color) DO NOTHING;
    
    -- Get count of inserted variants
    SELECT COUNT(*) INTO inventory_count FROM product_inventory;
    RAISE NOTICE '✅ Created % variant entries in product_inventory', inventory_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: EXECUTE VARIANT SYNC FIX (P0-005)
-- ============================================================================
-- This creates functions, triggers, and RLS policies for real-time sync

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STEP 3: Setting up variant sync system...';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- 3A: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get all active colors for a product
CREATE OR REPLACE FUNCTION get_product_colors(p_product_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  colors_array TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT color ORDER BY color)
  INTO colors_array
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true;
  
  RETURN COALESCE(colors_array, ARRAY[]::TEXT[]);
END;
$$;

COMMENT ON FUNCTION get_product_colors IS 'Returns array of distinct active colors for a product';

-- Function: Get all active sizes for a product
CREATE OR REPLACE FUNCTION get_product_sizes(p_product_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  sizes_array TEXT[];
BEGIN
  -- Return sizes in standard order: XS, S, M, L, XL, XXL
  SELECT ARRAY_AGG(size ORDER BY 
    CASE size
      WHEN 'XS' THEN 1
      WHEN 'S' THEN 2
      WHEN 'M' THEN 3
      WHEN 'L' THEN 4
      WHEN 'XL' THEN 5
      WHEN 'XXL' THEN 6
      WHEN 'Free Size' THEN 7
      ELSE 8
    END
  )
  INTO sizes_array
  FROM (
    SELECT DISTINCT size
    FROM product_inventory
    WHERE product_id = p_product_id
      AND is_active = true
  ) AS distinct_sizes;
  
  RETURN COALESCE(sizes_array, ARRAY[]::TEXT[]);
END;
$$;

COMMENT ON FUNCTION get_product_sizes IS 'Returns array of distinct active sizes for a product in standard order';

-- Function: Calculate total stock for a product
CREATE OR REPLACE FUNCTION calculate_total_stock(p_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COALESCE(SUM(stock), 0)
  INTO total
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true;
  
  RETURN total;
END;
$$;

COMMENT ON FUNCTION calculate_total_stock IS 'Calculates total stock across all active variants';

-- ============================================================================
-- 3B: STOCK DEDUCTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reduce_variant_stock(
  p_product_id UUID,
  p_size VARCHAR(10),
  p_color VARCHAR(50),
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT stock INTO v_current_stock
  FROM product_inventory
  WHERE product_id = p_product_id
    AND size = p_size
    AND color = p_color
    AND is_active = true
  FOR UPDATE;
  
  -- Check if variant exists and has sufficient stock
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Variant not found: product_id=%, size=%, color=%', p_product_id, p_size, p_color;
  END IF;
  
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: Available=%, Requested=%', v_current_stock, p_quantity;
  END IF;
  
  -- Reduce stock
  UPDATE product_inventory
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND size = p_size
    AND color = p_color
    AND is_active = true;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION reduce_variant_stock IS 'Atomically reduces stock for a specific variant with row-level locking';

-- ============================================================================
-- 3C: AUTOMATIC SYNC TRIGGER
-- ============================================================================

-- Trigger function: Auto-update products.total_stock when product_inventory changes
CREATE OR REPLACE FUNCTION sync_product_total_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the parent product's total_stock
  UPDATE products
  SET total_stock = (
    SELECT COALESCE(SUM(stock), 0)
    FROM product_inventory
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND is_active = true
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_sync_product_total_stock ON product_inventory;

CREATE TRIGGER trigger_sync_product_total_stock
AFTER INSERT OR UPDATE OR DELETE ON product_inventory
FOR EACH ROW
EXECUTE FUNCTION sync_product_total_stock();

COMMENT ON TRIGGER trigger_sync_product_total_stock ON product_inventory IS 'Auto-syncs products.total_stock when variants change';

-- ============================================================================
-- 3D: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on product_inventory
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can read active variants" ON product_inventory;
DROP POLICY IF EXISTS "Admins can manage variants" ON product_inventory;

-- Policy: Public can read active variants
CREATE POLICY "Public can read active variants"
  ON product_inventory
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy: Admins can manage all variants
CREATE POLICY "Admins can manage variants"
  ON product_inventory
  FOR ALL
  TO authenticated
  USING (
    -- Check if user is admin (requires helper function)
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- ============================================================================
-- 3E: PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for fast variant lookups
CREATE INDEX IF NOT EXISTS idx_product_inventory_lookup 
  ON product_inventory(product_id, size, color) 
  WHERE is_active = true;

-- Index for low stock alerts
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock 
  ON product_inventory(stock) 
  WHERE is_active = true AND stock < 10;

-- Index for stock queries
CREATE INDEX IF NOT EXISTS idx_product_inventory_stock 
  ON product_inventory(product_id, stock) 
  WHERE is_active = true;

-- ============================================================================
-- STEP 4: ENABLE REAL-TIME FOR PRODUCT_INVENTORY
-- ============================================================================

-- Note: This requires Supabase Dashboard action
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STEP 4: Real-time configuration';
  RAISE NOTICE '============================================';
  RAISE NOTICE '⚠️  MANUAL ACTION REQUIRED:';
  RAISE NOTICE '1. Go to Supabase Dashboard → Settings → API';
  RAISE NOTICE '2. Under "Realtime", enable the following tables:';
  RAISE NOTICE '   - product_inventory';
  RAISE NOTICE '   - products';
  RAISE NOTICE '3. Enable events: INSERT, UPDATE, DELETE';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  product_count INTEGER;
  inventory_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'STEP 5: Verification';
  RAISE NOTICE '============================================';
  
  -- Count products
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  RAISE NOTICE '✅ Active products: %', product_count;
  
  -- Count inventory variants
  SELECT COUNT(*) INTO inventory_count FROM product_inventory WHERE is_active = true;
  RAISE NOTICE '✅ Inventory variants: %', inventory_count;
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'get_product_colors',
      'get_product_sizes',
      'calculate_total_stock',
      'reduce_variant_stock'
    );
  RAISE NOTICE '✅ Helper functions: %/4', function_count;
  
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name = 'trigger_sync_product_total_stock';
  RAISE NOTICE '✅ Sync triggers: %/1', trigger_count;
  
  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'product_inventory';
  RAISE NOTICE '✅ RLS policies: %', policy_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ DATABASE FIX COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '1. Enable Realtime for product_inventory (see Step 4)';
  RAISE NOTICE '2. Restart backend server';
  RAISE NOTICE '3. Test dynamic variants: http://localhost:5000/api/products';
  RAISE NOTICE '4. Check homepage shows products';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- OPTIONAL: SAMPLE DATA VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to run verification queries:

-- See all products
-- SELECT id, name, category, total_stock FROM products WHERE is_active = true;

-- See all variants
-- SELECT 
--   p.name AS product,
--   pi.size,
--   pi.color,
--   pi.stock
-- FROM product_inventory pi
-- JOIN products p ON pi.product_id = p.id
-- WHERE pi.is_active = true
-- ORDER BY p.name, pi.size, pi.color;

-- Test dynamic color/size functions
-- SELECT 
--   p.name,
--   get_product_colors(p.id) AS available_colors,
--   get_product_sizes(p.id) AS available_sizes,
--   calculate_total_stock(p.id) AS calculated_stock,
--   p.total_stock AS stored_stock
-- FROM products p
-- WHERE p.is_active = true;
