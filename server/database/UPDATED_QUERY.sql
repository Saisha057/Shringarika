-- ============================================
-- UPDATED QUERY - Orders with Customer Information
-- Matches the project schema (users, not customers)
-- ============================================

-- Query for orders with customer information
-- Handles both registered users and guest orders
SELECT 
    o.id, 
    o.order_number, 
    o.total_price as total_amount,  -- Using total_price (actual column name in database) 
    o.status, 
    o.created_at,
    -- Use user name/phone if available, otherwise use guest customer info
    COALESCE(u.name, o.customer_name) as customer_name,
    COALESCE(u.phone, o.customer_phone) as customer_phone,
    u.email as customer_email, -- Only for registered users
    COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN users u ON o.user_id = u.id  -- LEFT JOIN to handle guest orders
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.total_price, o.status, o.created_at, 
         u.name, u.phone, u.email, o.customer_name, o.customer_phone
ORDER BY o.created_at DESC;

-- ============================================
-- ALTERNATIVE QUERY - If you only want registered users
-- ============================================

SELECT 
    o.id, 
    o.order_number, 
    o.total_price as total_amount,  -- Using total_price (actual column name in database) 
    o.status, 
    o.created_at,
    u.name as customer_name, 
    u.phone,
    u.email as customer_email,
    COUNT(oi.id) as item_count
FROM orders o
INNER JOIN users u ON o.user_id = u.id  -- Only registered users
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.total_price, o.status, o.created_at, 
         u.name, u.phone, u.email
ORDER BY o.created_at DESC;

-- ============================================
-- QUERY - Using JSONB order_items (if not using normalized order_items table)
-- ============================================

SELECT 
    o.id, 
    o.order_number, 
    o.total_price as total_amount,  -- Using total_price (actual column name in database) 
    o.status, 
    o.created_at,
    COALESCE(u.name, o.customer_name) as customer_name,
    COALESCE(u.phone, o.customer_phone) as customer_phone,
    u.email as customer_email,
    jsonb_array_length(o.order_items) as item_count  -- Count items from JSONB array
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC;

-- ============================================
-- QUERY - Get complete order details with customer, address, and product information
-- ============================================

-- Option 1: Using JSONB order_items and shipping_address (data stored as JSONB in orders table)
-- NOTE: In application code, use parameterized queries: WHERE o.id = $1 (PostgreSQL) or WHERE o.id = ? (with prepared statements)
-- For testing in SQL Editor, replace the UUID below with an actual order ID from your database

SELECT 
    o.*, 
    COALESCE(u.name, o.customer_name) as name,
    COALESCE(u.email, o.customer_email) as email,
    COALESCE(u.phone, o.customer_phone) as phone,
    -- Extract from JSONB shipping_address
    o.shipping_address->>'address_line1' as address_line1,
    o.shipping_address->>'address_line2' as address_line2,
    o.shipping_address->>'city' as city,
    o.shipping_address->>'state' as state,
    o.shipping_address->>'postal_code' as postal_code,
    o.shipping_address->>'country' as country,
    o.shipping_address->>'fullName' as address_full_name,
    o.shipping_address->>'phone' as address_phone,
    -- Extract from JSONB order_items array
    oi.item->>'name' as product_name,
    oi.item->>'size' as size,
    oi.item->>'color' as color,
    (oi.item->>'quantity')::INTEGER as quantity,
    (oi.item->>'unit_price')::DECIMAL(10,2) as unit_price,
    (oi.item->>'total_price')::DECIMAL(10,2) as item_total_price
FROM orders o
LEFT JOIN users u ON o.user_id = u.id  -- LEFT JOIN for guest orders
LEFT JOIN LATERAL jsonb_array_elements(o.order_items) AS oi(item) ON true
-- Uncomment and replace with actual order UUID for testing:
-- WHERE o.id = 'your-order-uuid-here';
-- Or use this to get the most recent order:
ORDER BY o.created_at DESC
LIMIT 1;

-- ============================================
-- INDEX CREATION STATEMENTS (Updated)
-- ============================================

-- Updated index statements matching the project schema
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);  -- Changed from customer_id to user_id
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);  -- Changed from idx_orders_date
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);  -- Changed from idx_order_items_order

