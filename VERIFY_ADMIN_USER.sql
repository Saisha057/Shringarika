-- Verify admin user exists with correct role
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/srdljxbumxkgjxoqqrzs

-- Step 1: Check if admin user exists
SELECT 
    id,
    name,
    email,
    role,
    is_verified,
    created_at,
    last_login
FROM users 
WHERE email = 'shringarika11@gmail.com';

-- Step 2: If role is not 'admin', update it
UPDATE users 
SET role = 'admin', 
    is_verified = true,
    updated_at = NOW()
WHERE email = 'shringarika11@gmail.com';

-- Step 3: Verify the update
SELECT 
    id,
    name,
    email,
    role,
    is_verified,
    created_at,
    last_login
FROM users 
WHERE email = 'shringarika11@gmail.com';

-- Expected result:
-- role should be 'admin'
-- is_verified should be true
