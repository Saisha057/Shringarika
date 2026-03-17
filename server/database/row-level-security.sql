-- =====================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Secure data access for multi-user environment
-- =====================================================

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get current user ID from JWT (Supabase auth)
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth_user_id() 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user is vendor
CREATE OR REPLACE FUNCTION is_vendor() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth_user_id() 
    AND role IN ('vendor', 'admin')
    AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Admins can view all users" ON users;
  DROP POLICY IF EXISTS "Admins can insert users" ON users;
  DROP POLICY IF EXISTS "Admins can update all users" ON users;
END $$;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth_user_id() OR is_admin());

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth_user_id())
  WITH CHECK (
    id = auth_user_id() 
    AND role = (SELECT role FROM users WHERE id = auth_user_id())
  );

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_admin());

-- Admins can insert users
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  WITH CHECK (is_admin());

-- Admins can update all users
CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  USING (is_admin());

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
END $$;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (user_id = auth_user_id() OR is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth_user_id());

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR ALL
  USING (is_admin());

-- =====================================================
-- SESSIONS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
END $$;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (user_id = auth_user_id() OR is_admin());

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  USING (user_id = auth_user_id());

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  USING (user_id = auth_user_id());

-- =====================================================
-- ADDRESSES TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own addresses" ON addresses;
END $$;

-- Users can manage their own addresses
CREATE POLICY "Users can manage own addresses"
  ON addresses FOR ALL
  USING (user_id = auth_user_id() OR is_admin());

-- =====================================================
-- CARTS & WISHLIST POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own cart" ON carts;
  DROP POLICY IF EXISTS "Users can manage own cart items" ON cart_items;
  DROP POLICY IF EXISTS "Users can manage own wishlist" ON wishlists;
END $$;

-- Users can manage their own cart
CREATE POLICY "Users can manage own cart"
  ON carts FOR ALL
  USING (user_id = auth_user_id() OR is_admin());

-- Users can manage their own cart items
CREATE POLICY "Users can manage own cart items"
  ON cart_items FOR ALL
  USING (
    cart_id IN (
      SELECT id FROM carts WHERE user_id = auth_user_id()
    ) OR is_admin()
  );

-- Users can manage their own wishlist
CREATE POLICY "Users can manage own wishlist"
  ON wishlists FOR ALL
  USING (user_id = auth_user_id() OR is_admin());

-- =====================================================
-- ORDERS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own orders" ON orders;
  DROP POLICY IF EXISTS "Users can create own orders" ON orders;
  DROP POLICY IF EXISTS "Admins can update orders" ON orders;
  DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
END $$;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (user_id = auth_user_id() OR is_admin());

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- Admins can update orders
CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (is_admin());

-- Users can view their own order items
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth_user_id()
    ) OR is_admin()
  );

-- =====================================================
-- PAYMENTS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own payments" ON payments;
  DROP POLICY IF EXISTS "Admins can manage payments" ON payments;
END $$;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth_user_id()
    ) OR is_admin()
  );

-- Admins and system can manage payments
CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (is_admin());

-- =====================================================
-- REVIEWS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
  DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
  DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
  DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
END $$;

-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT
  USING (is_approved = true OR user_id = auth_user_id() OR is_admin());

-- Users can create reviews
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth_user_id() OR is_admin());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (user_id = auth_user_id() OR is_admin());

-- =====================================================
-- NOTIFICATIONS TABLE POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
  DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
END $$;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth_user_id() OR is_admin());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth_user_id());

-- Admins can create notifications
CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (is_admin());

-- =====================================================
-- SUPPORT TICKETS POLICIES
-- =====================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
  DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
  DROP POLICY IF EXISTS "Admins can update tickets" ON support_tickets;
  DROP POLICY IF EXISTS "Users can view own ticket messages" ON support_messages;
  DROP POLICY IF EXISTS "Users can create messages for own tickets" ON support_messages;
END $$;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (user_id = auth_user_id() OR is_admin());

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- Admins can update tickets
CREATE POLICY "Admins can update tickets"
  ON support_tickets FOR UPDATE
  USING (is_admin());

-- Users can view their own ticket messages
CREATE POLICY "Users can view own ticket messages"
  ON support_messages FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth_user_id()
    ) OR is_admin()
  );

-- Users can create messages for their own tickets
CREATE POLICY "Users can create messages for own tickets"
  ON support_messages FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth_user_id()
    ) OR is_admin()
  );

-- =====================================================
-- PUBLIC READ POLICIES (No RLS for public data)
-- =====================================================

-- Products are publicly viewable (no RLS needed, but admins/vendors can manage)
-- Categories are publicly viewable
-- Banners are publicly viewable
-- FAQs are publicly viewable

-- Note: These tables don't have RLS enabled as they need to be publicly accessible

-- =====================================================
-- END OF RLS POLICIES
-- =====================================================
