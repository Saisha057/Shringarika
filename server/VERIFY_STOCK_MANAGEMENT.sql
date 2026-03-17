-- =====================================================
-- STOCK MANAGEMENT VERIFICATION & FIX
-- Run this in Supabase SQL Editor to check and fix all stock issues
-- =====================================================

-- Step 1: Verify product_inventory table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'product_inventory'
) as product_inventory_exists;

-- Step 2: If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size VARCHAR(50) NOT NULL,
  color VARCHAR(50),
  sku VARCHAR(100),
  stock INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_product_size_color UNIQUE (product_id, size, color)
);

-- Step 3: Add variant_info column to order_items if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'variant_info'
  ) THEN
    ALTER TABLE order_items ADD COLUMN variant_info JSONB;
    RAISE NOTICE 'Added variant_info column to order_items';
  ELSE
    RAISE NOTICE 'variant_info column already exists';
  END IF;
END $$;

-- Step 4: Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_stock ON product_inventory(stock);
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock ON product_inventory(stock) WHERE stock < 5;

-- Step 5: Verify check_stock_availability function exists
CREATE OR REPLACE FUNCTION check_stock_availability(p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_items JSONB = '[]'::JSONB;
  v_item JSONB;
  v_product_id TEXT;
  v_size TEXT;
  v_color TEXT;
  v_quantity INTEGER;
  v_available INTEGER;
  v_in_stock BOOLEAN;
BEGIN
  -- Loop through each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := v_item->>'productId';
    v_size := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Check stock in product_inventory
    SELECT stock INTO v_available
    FROM product_inventory
    WHERE product_id::TEXT = v_product_id
      AND size = v_size
    LIMIT 1;
    
    -- If no record found, assume out of stock
    IF v_available IS NULL THEN
      v_available := 0;
    END IF;
    
    v_in_stock := v_available >= v_quantity;
    
    -- Add result to items array
    v_items := v_items || jsonb_build_object(
      'productId', v_product_id,
      'variant', v_size,
      'quantity', v_quantity,
      'available', v_available,
      'inStock', v_in_stock,
      'isLowStock', v_available > 0 AND v_available < 5
    );
  END LOOP;
  
  -- Build final result
  v_result := jsonb_build_object(
    'items', v_items,
    'allInStock', NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_items) WHERE (value->>'inStock')::BOOLEAN = false
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Check current stock levels
SELECT 
  pi.product_id,
  p.name as product_name,
  pi.size,
  pi.color,
  pi.stock,
  CASE 
    WHEN pi.stock = 0 THEN 'OUT OF STOCK'
    WHEN pi.stock < 5 THEN 'LOW STOCK (< 5)'
    WHEN pi.stock < 10 THEN 'WARNING (< 10)'
    ELSE 'OK'
  END as stock_status
FROM product_inventory pi
LEFT JOIN products p ON p.id = pi.product_id
ORDER BY pi.stock ASC, p.name, pi.size;

-- Step 7: Count products by stock status
SELECT
  COUNT(*) FILTER (WHERE stock = 0) as out_of_stock,
  COUNT(*) FILTER (WHERE stock > 0 AND stock < 5) as low_stock,
  COUNT(*) FILTER (WHERE stock >= 5 AND stock < 10) as warning,
  COUNT(*) FILTER (WHERE stock >= 10) as ok,
  COUNT(*) as total
FROM product_inventory;

-- Step 8: Verify recent orders reduced stock
SELECT 
  o.id as order_id,
  o.order_number,
  o.created_at,
  oi.product_name,
  oi.quantity,
  CASE 
    WHEN oi.variant_info IS NOT NULL THEN oi.variant_info->>'size'
    ELSE 'N/A'
  END as ordered_size,
  CASE 
    WHEN oi.variant_info IS NOT NULL THEN oi.variant_info->>'color'
    ELSE 'N/A'
  END as ordered_color,
  pi.size as inventory_size,
  pi.color as inventory_color,
  pi.stock as current_stock,
  o.order_status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN product_inventory pi ON pi.product_id = oi.product_id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC
LIMIT 20;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- 1. product_inventory_exists should return TRUE
-- 2. Stock levels should show realistic numbers
-- 3. Low stock items (< 5) should be visible
-- 4. Recent orders should have corresponding stock reductions
-- =====================================================
