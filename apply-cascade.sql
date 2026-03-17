-- ============================================================================
-- APPLY CASCADE DELETION CONSTRAINTS
-- ============================================================================
-- This script ensures that when a product is deleted, all related records
-- in product_variants and product_inventory are automatically deleted.
--
-- BEFORE RUNNING: Backup your database!
-- ============================================================================

-- Step 1: Drop existing foreign key constraints (if any)
-- ============================================================================

ALTER TABLE IF EXISTS product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;

ALTER TABLE IF EXISTS product_inventory
  DROP CONSTRAINT IF EXISTS product_inventory_product_id_fkey;

ALTER TABLE IF EXISTS cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;


-- Step 2: Add new foreign key constraints WITH CASCADE
-- ============================================================================

-- product_variants: Delete variants when product is deleted
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- product_inventory: Delete inventory records when product is deleted
ALTER TABLE product_inventory
  ADD CONSTRAINT product_inventory_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- cart_items: Delete from carts when product is deleted
ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;


-- Step 3: Verify constraints were applied
-- ============================================================================

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.table_name IN ('product_variants', 'product_inventory', 'cart_items')
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'products'
ORDER BY tc.table_name;


-- ============================================================================
-- EXPECTED RESULT: You should see delete_rule = 'CASCADE' for:
-- - product_variants → products
-- - product_inventory → products
-- - cart_items → products
-- ============================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ CASCADE constraints applied successfully!';
  RAISE NOTICE 'Now when you delete a product:';
  RAISE NOTICE '  1. All variants will be automatically deleted';
  RAISE NOTICE '  2. All inventory records will be automatically deleted';
  RAISE NOTICE '  3. All cart items will be automatically deleted';
  RAISE NOTICE '  4. Order items are preserved for history';
END $$;
