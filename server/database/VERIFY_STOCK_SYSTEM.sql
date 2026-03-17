-- =====================================================
-- STOCK SYSTEM VERIFICATION SCRIPT
-- Run this AFTER applying CRITICAL_STOCK_FIX_FINAL.sql
-- This will verify everything is working correctly
-- =====================================================

-- =============================================================================
-- TEST 1: Check if all required functions exist
-- =============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 1: Verifying Database Functions';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  
  -- Count all stock-related functions
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN ('check_stock_availability', 'deduct_stock_atomic', 'restore_stock_atomic');
  
  RAISE NOTICE 'Total stock functions found: %', v_count;
  
  -- Check each function
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_stock_availability'
    AND pg_get_function_arguments(p.oid) LIKE '%p_items%JSONB%'
  ) THEN
    RAISE NOTICE '✅ check_stock_availability(JSONB) - FOUND';
  ELSE
    RAISE WARNING '❌ check_stock_availability(JSONB) - MISSING';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_stock_availability'
    AND pg_get_function_arguments(p.oid) LIKE '%p_product_id%UUID%'
  ) THEN
    RAISE NOTICE '✅ check_stock_availability(UUID, VARCHAR, VARCHAR, INTEGER) - FOUND';
  ELSE
    RAISE WARNING '❌ check_stock_availability(UUID, VARCHAR, VARCHAR, INTEGER) - MISSING';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'deduct_stock_atomic'
  ) THEN
    RAISE NOTICE '✅ deduct_stock_atomic - FOUND';
  ELSE
    RAISE WARNING '❌ deduct_stock_atomic - MISSING';
  END IF;
END $$;

-- =============================================================================
-- TEST 2: Check if product_inventory table exists and has data
-- =============================================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_row_count INTEGER;
  v_total_stock INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 2: Verifying product_inventory Table';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_inventory'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ product_inventory table EXISTS';
    
    SELECT COUNT(*), COALESCE(SUM(stock), 0) 
    INTO v_row_count, v_total_stock
    FROM product_inventory
    WHERE is_active = true;
    
    RAISE NOTICE '   ├─ Total variants: %', v_row_count;
    RAISE NOTICE '   ├─ Total stock: %', v_total_stock;
    RAISE NOTICE '   └─ Average stock per variant: %', CASE WHEN v_row_count > 0 THEN v_total_stock / v_row_count ELSE 0 END;
    
    IF v_row_count = 0 THEN
      RAISE WARNING '❌ Table exists but has NO DATA! Run STOCK_SYSTEM_FIX.sql phases 1-4';
    END IF;
  ELSE
    RAISE WARNING '❌ product_inventory table DOES NOT EXIST';
    RAISE WARNING '   Action Required: Run STOCK_SYSTEM_FIX.sql to create table';
  END IF;
END $$;

-- =============================================================================
-- TEST 3: Test JSONB version of check_stock_availability (Frontend)
-- =============================================================================

DO $$
DECLARE
  v_result JSONB;
  v_product_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 3: Testing Frontend Stock Check (JSONB version)';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  
  -- Get a sample product ID
  SELECT id INTO v_product_id FROM products LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE WARNING '❌ No products found in database';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Using sample product: %', v_product_id;
  
  -- Test the function
  BEGIN
    v_result := check_stock_availability(
      jsonb_build_array(
        jsonb_build_object(
          'productId', v_product_id::text,
          'variant', 'M',
          'quantity', 1
        )
      )
    );
    
    RAISE NOTICE '✅ Function executed successfully';
    RAISE NOTICE 'Result: %', v_result::text;
    
    IF v_result->>'success' = 'true' THEN
      RAISE NOTICE '✅ Function returned success=true';
    ELSE
      RAISE WARNING '❌ Function returned success=false: %', v_result->>'error';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Function call FAILED: %', SQLERRM;
  END;
END $$;

-- =============================================================================
-- TEST 4: Test individual parameter version (Backend)
-- =============================================================================

DO $$
DECLARE
  v_result JSONB;
  v_product_id UUID;
  v_size VARCHAR;
  v_color VARCHAR;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 4: Testing Backend Stock Check (Individual params)';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  
  -- Get a sample variant
  SELECT product_id, size, COALESCE(color, 'default')
  INTO v_product_id, v_size, v_color
  FROM product_inventory
  WHERE is_active = true
  LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE WARNING '❌ No variants found in product_inventory';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Using sample variant: product=%, size=%, color=%', v_product_id, v_size, v_color;
  
  -- Test the function
  BEGIN
    v_result := check_stock_availability(v_product_id, v_size, v_color, 1);
    
    RAISE NOTICE '✅ Function executed successfully';
    RAISE NOTICE 'Result: %', v_result::text;
    
    IF v_result->>'exists' = 'true' THEN
      RAISE NOTICE '✅ Variant exists';
      RAISE NOTICE '   ├─ In Stock: %', v_result->>'in_stock';
      RAISE NOTICE '   ├─ Available: %', v_result->>'available';
      RAISE NOTICE '   └─ Requested: %', v_result->>'requested';
    ELSE
      RAISE WARNING '❌ Variant not found: %', v_result->>'error';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '❌ Function call FAILED: %', SQLERRM;
  END;
END $$;

-- =============================================================================
-- TEST 5: Test stock deduction function
-- =============================================================================

DO $$
DECLARE
  v_result JSONB;
  v_product_id UUID;
  v_size VARCHAR;
  v_color VARCHAR;
  v_before_stock INTEGER;
  v_after_stock INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 5: Testing Stock Deduction (DRY RUN - NO COMMIT)';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  
  -- Get a variant with stock > 0
  SELECT product_id, size, COALESCE(color, 'default'), stock
  INTO v_product_id, v_size, v_color, v_before_stock
  FROM product_inventory
  WHERE is_active = true AND stock > 0
  ORDER BY stock DESC
  LIMIT 1;
  
  IF v_product_id IS NULL THEN
    RAISE WARNING '❌ No variants with stock found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Using variant: product=%, size=%, color=%, current_stock=%', 
    v_product_id, v_size, v_color, v_before_stock;
  
  -- Test in a transaction that we'll rollback
  BEGIN
    v_result := deduct_stock_atomic(v_product_id, v_size, v_color, 1);
    
    RAISE NOTICE '✅ Function executed';
    RAISE NOTICE 'Result: %', v_result::text;
    
    IF v_result->>'success' = 'true' THEN
      RAISE NOTICE '✅ Deduction successful';
      RAISE NOTICE '   ├─ Previous: %', v_result->>'previous_stock';
      RAISE NOTICE '   ├─ New: %', v_result->>'new_stock';
      RAISE NOTICE '   └─ Deducted: %', v_result->>'deducted';
      
      -- Verify in database
      SELECT stock INTO v_after_stock
      FROM product_inventory
      WHERE product_id = v_product_id 
        AND size = v_size 
        AND COALESCE(color, 'default') = v_color;
      
      IF v_after_stock = v_before_stock - 1 THEN
        RAISE NOTICE '✅ Database updated correctly (% -> %)', v_before_stock, v_after_stock;
      ELSE
        RAISE WARNING '❌ Database NOT updated correctly (expected %, got %)', v_before_stock - 1, v_after_stock;
      END IF;
    ELSE
      RAISE WARNING '❌ Deduction failed: %', v_result->>'error';
    END IF;
    
    -- CRITICAL: Rollback so we don't actually change stock
    RAISE NOTICE '🔄 Rolling back transaction (test only, no actual stock change)';
    RAISE EXCEPTION 'ROLLBACK_TEST';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM != 'ROLLBACK_TEST' THEN
        RAISE WARNING '❌ Function call FAILED: %', SQLERRM;
      END IF;
  END;
END $$;

-- =============================================================================
-- TEST 6: Display sample data
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST 6: Sample Data';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;

-- Show products with their total stock
SELECT 
  '📦 Products Table Sample' as info,
  id,
  name,
  total_stock,
  in_stock
FROM products
ORDER BY created_at DESC
LIMIT 5;

-- Show product_inventory variants
SELECT 
  '📋 Product Inventory Sample' as info,
  pi.product_id,
  p.name,
  pi.size,
  pi.color,
  pi.stock,
  pi.is_active
FROM product_inventory pi
JOIN products p ON p.id = pi.product_id
WHERE pi.is_active = true
ORDER BY pi.stock DESC
LIMIT 10;

-- =============================================================================
-- FINAL SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Check all tests above show ✅ (green checkmarks)';
  RAISE NOTICE '2. If any ❌ (red X), fix those issues first';
  RAISE NOTICE '3. Test from frontend: place an order';
  RAISE NOTICE '4. Verify stock decreases in admin dashboard';
  RAISE NOTICE '5. Check browser console for errors';
  RAISE NOTICE '';
  RAISE NOTICE 'If all tests pass, your stock system is ready! 🎉';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;
