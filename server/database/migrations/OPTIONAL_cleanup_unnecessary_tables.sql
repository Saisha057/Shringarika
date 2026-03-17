-- ============================================================================
-- OPTIONAL DATABASE CLEANUP SCRIPT
-- Execute this in Supabase SQL Editor to remove unnecessary tables
-- Date: December 23, 2025
-- ============================================================================

-- IMPORTANT: This script is OPTIONAL
-- Only run this if you want to clean up unused/duplicate tables
-- All critical fixes have been applied in the backend code

-- ============================================================================
-- SECTION 1: DROP DUPLICATE TABLES
-- ============================================================================

-- Drop product_variants table (DUPLICATE of product_inventory)
-- Reason: Old table from previous schema, replaced by product_inventory
-- Impact: None - backend code now uses product_inventory
-- Data: 0 rows (empty, unused)
DROP TABLE IF EXISTS product_variants CASCADE;

-- ============================================================================
-- SECTION 2: DROP UNUSED FEATURE TABLES
-- ============================================================================

-- Drop reviews table (Feature not implemented)
-- Reason: Product review feature not built on frontend
-- Impact: None - table never used
-- Data: 0 rows (empty)
DROP TABLE IF EXISTS reviews CASCADE;

-- Drop coupons table (Feature not implemented)
-- Reason: Discount/coupon feature not built
-- Impact: None - table never used
-- Data: 0 rows (empty)
DROP TABLE IF EXISTS coupons CASCADE;

-- ============================================================================
-- SECTION 3: DROP DUPLICATE STORAGE TABLES
-- ============================================================================

-- Drop addresses table (DUPLICATE storage)
-- Reason: Addresses already stored in orders.shipping_address (JSONB)
-- Impact: None - no code uses this table
-- Data: 0 rows (empty)
DROP TABLE IF EXISTS addresses CASCADE;

-- ============================================================================
-- SECTION 4: VERIFICATION
-- ============================================================================

-- List all remaining tables in public schema
SELECT 
    tablename,
    schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- EXPECTED RESULT:
-- The following tables should remain:
--   - products (4 rows)
--   - product_inventory (20 rows) ✅ CORRECT TABLE
--   - orders (28 rows)
--   - order_items (will populate with new orders)
--   - users (8 rows)
--   - ... (other active tables)
--
-- The following tables should be GONE:
--   - product_variants ❌ (was causing errors)
--   - reviews ❌ (unused)
--   - addresses ❌ (duplicate)
--   - coupons ❌ (unused)
-- ============================================================================
