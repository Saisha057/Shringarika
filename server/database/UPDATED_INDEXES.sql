-- ============================================
-- UPDATED INDEX CREATION STATEMENTS
-- Matches the project schema (users, not customers)
-- ============================================

-- Updated index statements matching the project schema
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);  -- Changed from customer_id to user_id
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);  -- Changed from idx_orders_date
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);  -- Changed from idx_order_items_order

-- ============================================
-- ORIGINAL (INCORRECT) STATEMENTS:
-- ============================================
-- CREATE INDEX idx_orders_status ON orders(status);
-- CREATE INDEX idx_orders_customer ON orders(customer_id);  -- ❌ Wrong: should be user_id
-- CREATE INDEX idx_orders_date ON orders(created_at);  -- ❌ Wrong: index name should be more descriptive
-- CREATE INDEX idx_order_items_order ON order_items(order_id);  -- ❌ Wrong: should be order_id not just "order"

-- ============================================
-- CHANGES MADE:
-- ============================================
-- 1. customer_id → user_id (to match users table, not customers)
-- 2. idx_orders_customer → idx_orders_user_id (more descriptive name)
-- 3. idx_orders_date → idx_orders_created_at (more descriptive name)
-- 4. idx_order_items_order → idx_order_items_order_id (more descriptive name)
-- 5. Added IF NOT EXISTS to prevent errors if indexes already exist

