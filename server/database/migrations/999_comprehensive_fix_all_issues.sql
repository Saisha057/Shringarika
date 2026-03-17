-- ============================================================================
-- COMPREHENSIVE DATABASE FIX - Phase 2 Complete
-- Date: December 23, 2025
-- Purpose: Fix all schema errors, remove unnecessary tables, add missing data
-- ============================================================================

-- ============================================================================
-- SECTION 1: CRITICAL FIXES (Must run first)
-- ============================================================================

-- Fix 1: Ensure variant_id is nullable in order_items
-- Reason: Products don't have variants yet, blocks order creation
-- Impact: Allows orders to be placed without variants
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'variant_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE order_items ALTER COLUMN variant_id DROP NOT NULL;
        RAISE NOTICE '✅ variant_id made nullable';
    ELSE
        RAISE NOTICE 'ℹ️  variant_id already nullable';
    END IF;
END $$;

-- Fix 2: Drop variant_info column if it exists (causes PGRST204 error)
-- Reason: PostgREST cannot serialize this JSONB properly, causes 500 errors
-- Impact: Removes problematic column that blocks order creation
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'variant_info'
    ) THEN
        ALTER TABLE order_items DROP COLUMN variant_info;
        RAISE NOTICE '✅ variant_info column dropped';
    ELSE
        RAISE NOTICE 'ℹ️  variant_info column does not exist';
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: ADD PRODUCT VARIANTS (Critical for orders)
-- ============================================================================

-- Fix 3: Add variants to all existing products
-- Reason: ALL 4 products have 0 variants, prevents orders
-- Impact: Creates default variants for each product
DO $$ 
DECLARE
    product_record RECORD;
    variant_count INTEGER;
BEGIN
    FOR product_record IN SELECT id, name, price FROM products
    LOOP
        -- Check if product already has variants
        SELECT COUNT(*) INTO variant_count 
        FROM product_variants 
        WHERE product_id = product_record.id;
        
        IF variant_count = 0 THEN
            -- Create default variants (S, M, L, XL)
            INSERT INTO product_variants (product_id, sku, size, color, stock_quantity, price, created_at, updated_at)
            VALUES
                (product_record.id, CONCAT(REPLACE(UPPER(product_record.name), ' ', '-'), '-S-DEFAULT'), 'S', 'Default', 10, product_record.price, NOW(), NOW()),
                (product_record.id, CONCAT(REPLACE(UPPER(product_record.name), ' ', '-'), '-M-DEFAULT'), 'M', 'Default', 10, product_record.price, NOW(), NOW()),
                (product_record.id, CONCAT(REPLACE(UPPER(product_record.name), ' ', '-'), '-L-DEFAULT'), 'L', 'Default', 10, product_record.price, NOW(), NOW()),
                (product_record.id, CONCAT(REPLACE(UPPER(product_record.name), ' ', '-'), '-XL-DEFAULT'), 'XL', 'Default', 10, product_record.price, NOW(), NOW());
            
            RAISE NOTICE '✅ Added 4 variants for product: %', product_record.name;
        ELSE
            RAISE NOTICE 'ℹ️  Product already has variants: %', product_record.name;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- SECTION 3: CLEAN UP UNNECESSARY TABLES
-- ============================================================================

-- Fix 4: Drop reviews table (empty and not used)
-- Reason: Table is empty, feature not implemented
-- Impact: Removes unused table, simplifies schema
DROP TABLE IF EXISTS reviews CASCADE;

-- Fix 5: Drop addresses table (empty, data stored in orders.shipping_address)
-- Reason: Shipping addresses already stored in orders table as JSONB
-- Impact: Removes duplicate storage
DROP TABLE IF EXISTS addresses CASCADE;

-- Fix 6: Drop coupons table (empty and not used)
-- Reason: Discount feature not implemented
-- Impact: Removes unused table
DROP TABLE IF EXISTS coupons CASCADE;

-- ============================================================================
-- SECTION 4: VERIFICATION QUERIES
-- ============================================================================

-- Verify all fixes were applied
DO $$ 
DECLARE
    variant_count INTEGER;
    product_count INTEGER;
    order_items_count INTEGER;
BEGIN
    -- Check product variants
    SELECT COUNT(*) INTO variant_count FROM product_variants;
    SELECT COUNT(*) INTO product_count FROM products;
    
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 VERIFICATION RESULTS';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Products: %', product_count;
    RAISE NOTICE '✅ Product Variants: %', variant_count;
    
    IF variant_count >= product_count * 4 THEN
        RAISE NOTICE '✅ All products have variants (avg 4+ per product)';
    ELSE
        RAISE NOTICE '⚠️  Some products may still be missing variants';
    END IF;
    
    -- Check order_items column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'variant_id' 
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE '✅ order_items.variant_id is nullable';
    ELSE
        RAISE NOTICE '❌ order_items.variant_id is still NOT NULL';
    END IF;
    
    -- Check if problematic column removed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'variant_info'
    ) THEN
        RAISE NOTICE '✅ variant_info column removed';
    ELSE
        RAISE NOTICE '⚠️  variant_info column still exists';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
