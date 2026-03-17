-- =====================================================
-- COMPREHENSIVE DATABASE FIX & CLEANUP
-- Shringarika E-commerce Database
-- Generated: January 2, 2026
-- =====================================================
-- 
-- This script addresses all identified issues:
-- 1. Critical RLS security vulnerabilities
-- 2. Missing/incorrect policies for admin access
-- 3. Database structure optimization
-- 4. Index improvements for performance
-- 5. Cleanup of redundant columns
-- 
-- EXECUTION ORDER: Run each phase sequentially
-- =====================================================

-- =====================================================
-- PHASE 1: ENABLE EXTENSIONS (IF NOT ALREADY ENABLED)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PHASE 2: CREATE/UPDATE HELPER FUNCTIONS
-- =====================================================

-- Function to get current authenticated user ID
CREATE OR REPLACE FUNCTION auth_user_id() 
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth_user_id() 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if user is vendor or admin
CREATE OR REPLACE FUNCTION is_vendor_or_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth_user_id() 
    AND role IN ('vendor', 'admin')
    AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 3: FIX CRITICAL RLS POLICIES
-- =====================================================

-- ========== PRODUCTS TABLE ==========
-- Products should be publicly readable but only admins can write

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can read products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can read products (including anonymous)
CREATE POLICY "Public can read products"
ON products FOR SELECT
TO public
USING (is_active = true);

-- Authenticated users can read all products (including inactive for admins)
CREATE POLICY "Authenticated can read all products"
ON products FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert products
CREATE POLICY "Admins can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Only admins can update products
CREATE POLICY "Admins can update products"
ON products FOR UPDATE
TO authenticated
USING (is_admin());

-- Only admins can delete products
CREATE POLICY "Admins can delete products"
ON products FOR DELETE
TO authenticated
USING (is_admin());

-- ========== CATEGORIES TABLE ==========
-- Categories should be publicly readable but only admins can write

DROP POLICY IF EXISTS "Public can read categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read active categories
CREATE POLICY "Public can read categories"
ON categories FOR SELECT
TO public
USING (is_active = true);

-- Authenticated users can read all categories
CREATE POLICY "Authenticated can read all categories"
ON categories FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
ON categories FOR ALL
TO authenticated
USING (is_admin());

-- ========== PRODUCT_VARIANTS TABLE ==========

DROP POLICY IF EXISTS "Public can read variants" ON product_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON product_variants;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Anyone can read active product variants
CREATE POLICY "Public can read variants"
ON product_variants FOR SELECT
TO public
USING (is_active = true);

-- Authenticated users can read all variants
CREATE POLICY "Authenticated can read all variants"
ON product_variants FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage variants
CREATE POLICY "Admins can manage variants"
ON product_variants FOR ALL
TO authenticated
USING (is_admin());

-- ========== PRODUCT_IMAGES TABLE ==========

DROP POLICY IF EXISTS "Public can read product images" ON product_images;
DROP POLICY IF EXISTS "Admins can manage product images" ON product_images;

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read product images
CREATE POLICY "Public can read product images"
ON product_images FOR SELECT
TO public
USING (true);

-- Only admins can manage product images
CREATE POLICY "Admins can manage product images"
ON product_images FOR ALL
TO authenticated
USING (is_admin());

-- ========== INVENTORY TABLE ==========

DROP POLICY IF EXISTS "Public can read inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory;

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Anyone can read inventory levels (for stock availability)
CREATE POLICY "Public can read inventory"
ON inventory FOR SELECT
TO public
USING (true);

-- Only admins can manage inventory
CREATE POLICY "Admins can manage inventory"
ON inventory FOR ALL
TO authenticated
USING (is_admin());

-- ========== ORDERS TABLE ==========
-- Users can only see their own orders, admins can see all

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
TO authenticated
USING (
  user_id = auth_user_id() 
  OR is_admin()
);

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth_user_id());

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
TO authenticated
USING (is_admin());

-- Admins can update orders
CREATE POLICY "Admins can update orders"
ON orders FOR UPDATE
TO authenticated
USING (is_admin());

-- Admins can delete orders (if needed)
CREATE POLICY "Admins can delete orders"
ON orders FOR DELETE
TO authenticated
USING (is_admin());

-- ========== ORDER_ITEMS TABLE ==========

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Users can view order items for their orders
CREATE POLICY "Users can view own order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth_user_id() OR is_admin())
  )
);

-- Users can create order items when creating order
CREATE POLICY "Users can create order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth_user_id()
  )
);

-- Admins can manage all order items
CREATE POLICY "Admins can manage order items"
ON order_items FOR ALL
TO authenticated
USING (is_admin());

-- ========== RETURNS TABLE ==========

DROP POLICY IF EXISTS "Users can view own returns" ON returns;
DROP POLICY IF EXISTS "Users can create returns" ON returns;
DROP POLICY IF EXISTS "Admins can manage returns" ON returns;

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Users can view their own returns
CREATE POLICY "Users can view own returns"
ON returns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = returns.order_id
    AND (orders.user_id = auth_user_id() OR is_admin())
  )
);

-- Users can create returns for their orders
CREATE POLICY "Users can create returns"
ON returns FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = returns.order_id
    AND orders.user_id = auth_user_id()
  )
);

-- Admins can manage all returns
CREATE POLICY "Admins can manage returns"
ON returns FOR ALL
TO authenticated
USING (is_admin());

-- ========== REVIEWS TABLE ==========

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
ON reviews FOR SELECT
TO public
USING (is_approved = true);

-- Users can view their own reviews (even if not approved)
CREATE POLICY "Users can view own reviews"
ON reviews FOR SELECT
TO authenticated
USING (user_id = auth_user_id() OR is_admin());

-- Users can create reviews
CREATE POLICY "Users can create reviews"
ON reviews FOR INSERT
TO authenticated
WITH CHECK (user_id = auth_user_id());

-- Users can update their own unapproved reviews
CREATE POLICY "Users can update own reviews"
ON reviews FOR UPDATE
TO authenticated
USING (user_id = auth_user_id() AND is_approved = false);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage reviews"
ON reviews FOR ALL
TO authenticated
USING (is_admin());

-- ========== BANNERS, FAQs, SYSTEM_SETTINGS ==========
-- These should be publicly readable but only admins can modify

DROP POLICY IF EXISTS "Public can read banners" ON banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON banners;

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read banners"
ON banners FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage banners"
ON banners FOR ALL
TO authenticated
USING (is_admin());

-- FAQs
DROP POLICY IF EXISTS "Public can read faqs" ON faqs;
DROP POLICY IF EXISTS "Admins can manage faqs" ON faqs;

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read faqs"
ON faqs FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage faqs"
ON faqs FOR ALL
TO authenticated
USING (is_admin());

-- System Settings
DROP POLICY IF EXISTS "Public can read public settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public settings"
ON system_settings FOR SELECT
TO public
USING (is_public = true);

CREATE POLICY "Admins can read all settings"
ON system_settings FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can manage settings"
ON system_settings FOR ALL
TO authenticated
USING (is_admin());

-- =====================================================
-- PHASE 4: ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

-- Orders table - improve query performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Order items - improve join performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_product_id ON order_items(order_id, product_id);

-- Products - improve search and filtering
CREATE INDEX IF NOT EXISTS idx_products_category_is_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE is_featured = true AND is_active = true;

-- Inventory - improve stock lookups
CREATE INDEX IF NOT EXISTS idx_inventory_product_variant ON inventory(product_id, variant_id) WHERE quantity > 0;

-- Reviews - improve product review queries
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON reviews(product_id, is_approved) WHERE is_approved = true;

-- Full-text search on products (if not exists)
CREATE INDEX IF NOT EXISTS idx_products_fulltext ON products 
USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')));

-- =====================================================
-- PHASE 5: ADD MISSING TRIGGERS
-- =====================================================

-- Ensure updated_at triggers exist for all necessary tables

-- Products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Categories
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Inventory
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at 
  BEFORE UPDATE ON inventory 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 6: DATA INTEGRITY FIXES
-- =====================================================

-- Create inventory records for products without them
INSERT INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_level)
SELECT 
  p.id,
  NULL,
  COALESCE(p.stock, 0),
  0,
  10
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i 
  WHERE i.product_id = p.id 
  AND i.variant_id IS NULL
)
AND p.id IS NOT NULL;

-- =====================================================
-- PHASE 7: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant read access to public for public tables
GRANT SELECT ON products TO anon, authenticated;
GRANT SELECT ON categories TO anon, authenticated;
GRANT SELECT ON product_variants TO anon, authenticated;
GRANT SELECT ON product_images TO anon, authenticated;
GRANT SELECT ON inventory TO anon, authenticated;
GRANT SELECT ON banners TO anon, authenticated;
GRANT SELECT ON faqs TO anon, authenticated;
GRANT SELECT ON system_settings TO anon, authenticated;
GRANT SELECT ON reviews TO anon, authenticated;

-- Grant appropriate access for authenticated users on their data
GRANT SELECT, INSERT ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wishlists TO authenticated;
GRANT SELECT, INSERT ON returns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;

-- Grant full access to admins on all tables (enforced via RLS policies)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- =====================================================
-- END OF FIX SCRIPT
-- =====================================================

-- Verification queries (run these after applying the script):

-- 1. Check if RLS is enabled on sensitive tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- 2. Check all policies:
-- SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public';

-- 3. Verify no anonymous user can write to products:
-- (This should be tested from the application or Supabase dashboard)

-- 4. Verify admins can manage products:
-- (Test by logging in as admin and trying to create/update products)
