-- Check if admin account is actually approved
SELECT 
  id,
  email, 
  first_name, 
  last_name, 
  role, 
  is_approved, 
  approved_at,
  created_at
FROM user_profiles 
WHERE email = '2646502936yjh@gmail.com';

-- If not approved, force approve it
UPDATE user_profiles 
SET 
  is_approved = true,
  approved_by = id,
  approved_at = NOW(),
  role = 'admin'
WHERE email = '2646502936yjh@gmail.com' 
AND (is_approved = false OR role != 'admin');

-- Final verification
SELECT 
  'Admin account status:' as check_type,
  email, 
  role, 
  is_approved, 
  approved_at
FROM user_profiles 
WHERE email = '2646502936yjh@gmail.com';