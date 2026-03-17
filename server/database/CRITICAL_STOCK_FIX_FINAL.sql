-- =====================================================
-- CRITICAL STOCK SYSTEM FIX - FINAL VERSION
-- This fixes the 500 error and stock not decreasing issues
-- Run this in Supabase SQL Editor IMMEDIATELY
-- =====================================================

-- =============================================================================
-- PART 1: Create JSONB array version (for frontend stock checks)
-- =============================================================================

CREATE OR REPLACE FUNCTION check_stock_availability(p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant TEXT;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_available BOOLEAN;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
  v_all_available BOOLEAN := TRUE;
  v_size TEXT;
  v_color TEXT;
BEGIN
  RAISE NOTICE 'check_stock_availability called with items: %', p_items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract fields with null handling
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    
    -- Parse variant string if provided (e.g. "M-Red")
    IF v_variant IS NOT NULL AND v_variant != '' THEN
      -- Split variant into size and color
      v_size := split_part(v_variant, '-', 1);
      v_color := split_part(v_variant, '-', 2);
      IF v_color IS NULL OR v_color = '' THEN
        v_color := 'default';
      END IF;
    ELSE
      v_size := NULL;
      v_color := 'default';
    END IF;
    
    RAISE NOTICE 'Checking stock for product: %, size: %, color: %, qty: %', v_product_id, v_size, v_color, v_quantity;
    
    -- Query product_inventory table
    IF v_size IS NOT NULL THEN
      SELECT COALESCE(stock, 0) INTO v_current_stock
      FROM product_inventory
      WHERE product_id = v_product_id
        AND size = v_size
        AND COALESCE(color, 'default') = v_color
        AND is_active = true;
        
      IF v_current_stock IS NULL THEN
        -- Variant not found, check if product exists
        IF EXISTS (SELECT 1 FROM products WHERE id = v_product_id) THEN
          v_current_stock := 0; -- Product exists but variant doesn't
        ELSE
          v_current_stock := 0; -- Product doesn't exist
        END IF;
      END IF;
    ELSE
      -- No size specified, sum all variants
      SELECT COALESCE(SUM(stock), 0) INTO v_current_stock
      FROM product_inventory
      WHERE product_id = v_product_id
        AND is_active = true;
        
      IF v_current_stock IS NULL OR v_current_stock = 0 THEN
        -- Fallback to products table
        SELECT COALESCE(total_stock, 0) INTO v_current_stock
        FROM products
        WHERE id = v_product_id;
      END IF;
    END IF;
    
    v_available := COALESCE(v_current_stock, 0) >= v_quantity;
    
    IF NOT v_available THEN
      v_all_available := FALSE;
    END IF;
    
    v_result := jsonb_build_object(
      'productId', v_product_id,
      'variant', v_variant,
      'requested', v_quantity,
      'available', COALESCE(v_current_stock, 0),
      'inStock', v_available
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', TRUE, 
    'allAvailable', v_all_available, 
    'items', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in check_stock_availability: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', FALSE, 
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_stock_availability(JSONB) IS 'Check stock availability for multiple items (JSONB array version)';

-- =============================================================================
-- PART 2: Create individual parameter version (for backend order processing)
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
  RAISE NOTICE 'check_stock_availability (individual) called: product=%, size=%, color=%, qty=%', 
    p_product_id, p_size, p_color, p_quantity;

  -- Input validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'exists', false,
      'in_stock', false,
      'error', 'Invalid quantity',
      'requested', p_quantity
    );
  END IF;

  -- Check stock from product_inventory
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
    'low_stock', v_current_stock <= (SELECT COALESCE(low_stock_threshold, 10) FROM product_inventory WHERE id = v_variant_id)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in check_stock_availability: %', SQLERRM;
    RETURN jsonb_build_object(
      'exists', false,
      'in_stock', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_stock_availability(UUID, VARCHAR, VARCHAR, INTEGER) IS 'Check stock availability for single item (individual parameters version)';

-- =============================================================================
-- PART 3: Create/Fix atomic stock deduction function
-- =============================================================================

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
BEGIN
  RAISE NOTICE 'deduct_stock_atomic called: product=%, size=%, color=%, qty=%', 
    p_product_id, p_size, p_color, p_quantity;

  -- Validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid quantity'
    );
  END IF;

  -- CRITICAL: Row-level lock to prevent race conditions
  SELECT id, stock INTO v_variant_id, v_current_stock
  FROM product_inventory
  WHERE product_id = p_product_id
    AND size = p_size
    AND COALESCE(color, 'default') = COALESCE(p_color, 'default')
    AND is_active = true
  FOR UPDATE; -- This locks the row until transaction completes

  -- Variant doesn't exist
  IF v_variant_id IS NULL THEN
    RAISE NOTICE 'Variant not found: product=%, size=%, color=%', p_product_id, p_size, p_color;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
    );
  END IF;

  -- Insufficient stock
  IF v_current_stock < p_quantity THEN
    RAISE NOTICE 'Insufficient stock: available=%, requested=%', v_current_stock, p_quantity;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'available', v_current_stock,
      'requested', p_quantity
    );
  END IF;

  -- Calculate new stock
  v_new_stock := v_current_stock - p_quantity;

  -- Update variant stock
  UPDATE product_inventory
  SET 
    stock = v_new_stock,
    updated_at = NOW()
  WHERE id = v_variant_id;

  -- Update product total stock
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

  RAISE NOTICE 'Stock deducted successfully: % -> %', v_current_stock, v_new_stock;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'deducted', p_quantity
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in deduct_stock_atomic: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deduct_stock_atomic IS 'Atomically deduct stock with row-level locking (prevents overselling)';

-- =============================================================================
-- PART 4: Grant permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION check_stock_availability(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_stock_availability(UUID, VARCHAR, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_stock_atomic TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check if functions exist
DO $$
BEGIN
  RAISE NOTICE '=== Function Verification ===';
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_stock_availability'
    AND pg_get_function_arguments(p.oid) LIKE '%JSONB%'
  ) THEN
    RAISE NOTICE '✅ check_stock_availability(JSONB) exists';
  ELSE
    RAISE WARNING '❌ check_stock_availability(JSONB) NOT FOUND';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_stock_availability'
    AND pg_get_function_arguments(p.oid) LIKE '%UUID%'
  ) THEN
    RAISE NOTICE '✅ check_stock_availability(UUID, ...) exists';
  ELSE
    RAISE WARNING '❌ check_stock_availability(UUID, ...) NOT FOUND';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'deduct_stock_atomic'
  ) THEN
    RAISE NOTICE '✅ deduct_stock_atomic exists';
  ELSE
    RAISE WARNING '❌ deduct_stock_atomic NOT FOUND';
  END IF;
END $$;

-- Display product inventory sample
SELECT 
  'Sample inventory data:' as info,
  COUNT(*) as total_variants,
  SUM(stock) as total_stock,
  COUNT(DISTINCT product_id) as unique_products
FROM product_inventory
WHERE is_active = true;

-- Final completion message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STOCK SYSTEM FIX COMPLETE ===';
  RAISE NOTICE 'Next step: Test by placing an order and checking if stock decreases';
  RAISE NOTICE '';
END $$;
