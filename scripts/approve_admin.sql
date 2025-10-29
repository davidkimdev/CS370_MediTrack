-- Fix admin account approval status
-- Run this in Supabase SQL Editor to approve the admin account

UPDATE user_profiles 
SET 
  is_approved = true,
  approved_by = id,
  approved_at = NOW(),
  role = 'admin'
WHERE email = '2646502936yjh@gmail.com';

-- Verify the update
SELECT 
  email, 
  first_name, 
  last_name, 
  role, 
  is_approved, 
  approved_at
FROM user_profiles 
WHERE email = '2646502936yjh@gmail.com';

-- Success message
SELECT '✅ Admin account approved and role set!' AS result;