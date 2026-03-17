-- ============================================================
-- RLS FIX: Allow admin & service_role to update orders table
-- Run this in Supabase SQL Editor (one-time)
-- ============================================================

-- Step 1: Drop conflicting policies if they already exist (safe to re-run)
DROP POLICY IF EXISTS "service_role_all" ON orders;
DROP POLICY IF EXISTS "admin_update_orders" ON orders;
DROP POLICY IF EXISTS "Admins approve exchanges" ON orders;
DROP POLICY IF EXISTS "Service role full access" ON orders;

-- Step 2: Service role bypass (backend uses this key — bypasses ALL RLS)
CREATE POLICY "service_role_all"
ON orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 3: Authenticated admins can UPDATE any order (for exchange/return approvals)
CREATE POLICY "admin_update_orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR auth.jwt() ->> 'app_role' = 'admin'
  OR auth.jwt() ->> 'is_admin' = 'true'
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'admin'
  OR auth.jwt() ->> 'app_role' = 'admin'
  OR auth.jwt() ->> 'is_admin' = 'true'
);

-- Step 4: Authenticated admins can SELECT all orders
DROP POLICY IF EXISTS "admin_select_all_orders" ON orders;
CREATE POLICY "admin_select_all_orders"
ON orders
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR auth.jwt() ->> 'app_role' = 'admin'
  OR auth.jwt() ->> 'is_admin' = 'true'
  OR auth.uid() = user_id
);

-- Step 5: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION: Confirm policies created
-- ============================================================
SELECT
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;
