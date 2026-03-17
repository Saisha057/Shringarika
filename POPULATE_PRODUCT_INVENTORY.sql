-- ========================================
-- P0-006: POPULATE PRODUCT_INVENTORY FIX
-- ========================================
-- This script populates the product_inventory table with variant data
-- for all active products that have sizes and colors defined.
--
-- Execute this AFTER adding products to the products table.
-- Run in Supabase SQL Editor: https://srdljxbumxkgjxoqqrzs.supabase.co
--
-- ========================================

-- Step 1: Check if products exist
DO $$
DECLARE
  product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  
  IF product_count = 0 THEN
    RAISE NOTICE '⚠️  No active products found. Please add products first (P0-001).';
    RAISE EXCEPTION 'Cannot populate inventory without products';
  ELSE
    RAISE NOTICE '✅ Found % active products', product_count;
  END IF;
END $$;

-- Step 2: Clear existing inventory (optional - remove if you want to keep existing data)
-- TRUNCATE TABLE product_inventory CASCADE;

-- Step 3: Populate product_inventory with all size/color combinations
INSERT INTO product_inventory (product_id, size, color, stock, is_active, created_at, updated_at)
SELECT 
  p.id AS product_id,
  size,
  color,
  50 AS stock, -- Default stock quantity
  true AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM products p
CROSS JOIN LATERAL unnest(p.sizes) AS size
CROSS JOIN LATERAL unnest(p.colors) AS color
WHERE p.is_active = true
  AND p.sizes IS NOT NULL
  AND array_length(p.sizes, 1) > 0
  AND p.colors IS NOT NULL
  AND array_length(p.colors, 1) > 0
ON CONFLICT (product_id, size, color) DO UPDATE
  SET 
    stock = EXCLUDED.stock,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Step 4: Verify insertion
DO $$
DECLARE
  inventory_count INTEGER;
  product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inventory_count FROM product_inventory;
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PRODUCT INVENTORY POPULATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Products: %', product_count;
  RAISE NOTICE 'Total Variants: %', inventory_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- Step 5: Show sample data
SELECT 
  p.name AS product_name,
  pi.size,
  pi.color,
  pi.stock,
  pi.is_active
FROM product_inventory pi
JOIN products p ON pi.product_id = p.id
ORDER BY p.name, pi.size, pi.color
LIMIT 20;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check products with no variants
SELECT 
  p.id,
  p.name,
  array_length(p.sizes, 1) AS size_count,
  array_length(p.colors, 1) AS color_count,
  (SELECT COUNT(*) FROM product_inventory WHERE product_id = p.id) AS variant_count
FROM products p
WHERE p.is_active = true
ORDER BY variant_count ASC;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Setup complete! Next steps:';
  RAISE NOTICE '1. Restart backend server: npm run dev';
  RAISE NOTICE '2. Test dynamic variants: http://localhost:5000/api/products/{id}/variants-dynamic';
  RAISE NOTICE '3. Open frontend: http://localhost:3000';
  RAISE NOTICE '';
END $$;
