-- =====================================================
-- ROW LEVEL SECURITY (RLS) FOR USER ORDER ACCESS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own orders
CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
TO authenticated
USING (
  auth.uid()::text = user_id::text
  OR 
  auth.uid()::text = guest_uuid::text
);

-- Policy: Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()::text
    AND users.role = 'admin'
  )
);

-- Enable RLS on order_items table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view order items for their orders
CREATE POLICY "Users can view own order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id::text = auth.uid()::text
      OR 
      orders.guest_uuid::text = auth.uid()::text
    )
  )
);

-- Policy: Admins can view all order items
CREATE POLICY "Admins can view all order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id::text = auth.uid()::text
    AND users.role = 'admin'
  )
);

-- Grant necessary permissions
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON products TO authenticated;
GRANT SELECT ON product_variants TO authenticated;
