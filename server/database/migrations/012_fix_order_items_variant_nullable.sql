-- ================================================
-- PHASE 1.5: FIX ORDER_ITEMS CREATION
-- ================================================

-- Step 1: Make variant_id nullable (orders can exist without specific variants)
-- This allows order_items to be created even when products don't have variants yet

ALTER TABLE order_items 
ALTER COLUMN variant_id DROP NOT NULL;

-- Step 2: Verify the change
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'order_items'
ORDER BY ordinal_position;

-- Step 3: Check if there are any other blocking constraints
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'order_items'
  AND table_schema = 'public';

-- ================================================
-- VERIFICATION QUERY
-- ================================================
-- After fix, this should work:
-- INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, total_price, product_name)
-- VALUES ('test-order-id', 'test-product-id', NULL, 1, 1000, 1000, 'Test Product');
