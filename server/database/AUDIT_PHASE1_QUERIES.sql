-- ================================================
-- PHASE 1: COMPREHENSIVE SCHEMA AUDIT (READ-ONLY)
-- PostgreSQL + Supabase Database Analysis
-- ================================================

-- ================================================
-- SECTION 1: ALL TABLES WITH DETAILS
-- ================================================

-- Query 1.1: List all tables with row counts and RLS status
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM pg_class c WHERE c.relname = t.tablename) as exists_check,
    (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = t.tablename) as estimated_rows,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as rls_policies_count,
    (SELECT relrowsecurity FROM pg_class WHERE relname = t.tablename AND relnamespace = 'public'::regnamespace) as rls_enabled
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- Query 1.2: Get actual row counts (slower but accurate)
-- Run separately for each table
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'carts', COUNT(*) FROM carts
UNION ALL SELECT 'cart_items', COUNT(*) FROM cart_items
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'wishlists', COUNT(*) FROM wishlists
UNION ALL SELECT 'wishlist_items', COUNT(*) FROM wishlist_items
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'coupons', COUNT(*) FROM coupons
UNION ALL SELECT 'addresses', COUNT(*) FROM addresses
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'support_tickets', COUNT(*) FROM support_tickets
UNION ALL SELECT 'support_messages', COUNT(*) FROM support_messages
UNION ALL SELECT 'stock_history', COUNT(*) FROM stock_history
UNION ALL SELECT 'analytics_events', COUNT(*) FROM analytics_events
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'api_keys', COUNT(*) FROM api_keys
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'exports', COUNT(*) FROM exports
UNION ALL SELECT 'backups', COUNT(*) FROM backups;

-- ================================================
-- SECTION 2: FOREIGN KEY DEPENDENCIES
-- ================================================

-- Query 2.1: All foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Query 2.2: Tables with NO foreign keys (potentially orphaned)
SELECT 
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.table_constraints tc 
     WHERE tc.table_name = t.table_name 
     AND tc.table_schema = 'public' 
     AND tc.constraint_type = 'FOREIGN KEY') as fk_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_name = t.table_name
        AND tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    )
ORDER BY t.table_name;

-- ================================================
-- SECTION 3: FUNCTIONS AND TRIGGERS
-- ================================================

-- Query 3.1: All functions in public schema
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END as volatility,
    l.lanname as language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Query 3.2: All triggers
SELECT 
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as trigger_type,
    CASE t.tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT OR DELETE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 24 THEN 'DELETE OR UPDATE'
        WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    END as trigger_event,
    t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ================================================
-- SECTION 4: INDEXES
-- ================================================

-- Query 4.1: All indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Query 4.2: Unused indexes (low usage)
SELECT
    schemaname,
    tablename,
    indexrelname as index_name,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan < 10
ORDER BY idx_scan, tablename;

-- ================================================
-- SECTION 5: CONSTRAINTS
-- ================================================

-- Query 5.1: All CHECK constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- Query 5.2: All UNIQUE constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ') as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- ================================================
-- SECTION 6: RLS POLICIES
-- ================================================

-- Query 6.1: All RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Query 6.2: Tables with RLS enabled but NO policies
SELECT
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = c.relname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = c.relname
    )
ORDER BY c.relname;

-- ================================================
-- SECTION 7: DUPLICATE OR SIMILAR TABLES
-- ================================================

-- Query 7.1: Tables with similar names (potential duplicates)
SELECT
    t1.table_name as table1,
    t2.table_name as table2,
    similarity(t1.table_name, t2.table_name) as name_similarity
FROM information_schema.tables t1
CROSS JOIN information_schema.tables t2
WHERE t1.table_schema = 'public'
    AND t2.table_schema = 'public'
    AND t1.table_name < t2.table_name
    AND (
        t1.table_name LIKE t2.table_name || '%'
        OR t2.table_name LIKE t1.table_name || '%'
        OR levenshtein(t1.table_name, t2.table_name) < 3
    )
ORDER BY name_similarity DESC;

-- ================================================
-- SECTION 8: COLUMN ANALYSIS
-- ================================================

-- Query 8.1: All columns for critical tables
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('users', 'products', 'orders', 'order_items', 'product_variants')
ORDER BY table_name, ordinal_position;

-- ================================================
-- SECTION 9: PROBLEM DETECTION
-- ================================================

-- Query 9.1: Orders without order_items
SELECT 
    o.id,
    o.order_number,
    o.created_at,
    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
FROM orders o
WHERE NOT EXISTS (
    SELECT 1 FROM order_items WHERE order_id = o.id
);

-- Query 9.2: Products without variants (if variants are required)
SELECT
    p.id,
    p.name,
    (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variants_count
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM product_variants WHERE product_id = p.id
);

-- Query 9.3: Orphaned order_items (no parent order)
SELECT
    oi.id,
    oi.order_id,
    oi.product_id
FROM order_items oi
WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE id = oi.order_id
);

-- Query 9.4: Users with no orders
SELECT
    u.id,
    u.email,
    u.created_at,
    (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE user_id = u.id
)
ORDER BY u.created_at DESC
LIMIT 20;

-- ================================================
-- SECTION 10: STORAGE ANALYSIS
-- ================================================

-- Query 10.1: Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ================================================
-- SECTION 11: PERMISSIONS AUDIT
-- ================================================

-- Query 11.1: Table permissions
SELECT
    grantee,
    table_schema,
    table_name,
    string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;

-- ================================================
-- END OF AUDIT SCRIPT
-- ================================================

-- NOTES:
-- 1. Run each query separately in Supabase SQL Editor
-- 2. Save results for each section
-- 3. Some queries may need pg_trgm extension for similarity functions
-- 4. This is READ-ONLY - no data is modified
