-- ✅ UPDATE ADMIN PASSWORD TO: Admin@123456
-- Run this SQL in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

UPDATE users 
SET password = '$2a$10$qjfyuyCbXS4Azht1r79yaOx.GNOkiA8MoE5Lax.gx5i.3WTca3OHW' 
WHERE email = 'shringarika11@gmail.com';

-- ✅ Verify the update
SELECT id, email, role, created_at 
FROM users 
WHERE email = 'shringarika11@gmail.com';

-- ✅ After running this, login with:
--    Email: shringarika11@gmail.com
--    Password: Admin@123456
