-- ============================================================================
-- INVITATION CODES SETUP
-- ============================================================================
-- Run this in Supabase SQL Editor to create sample invitation codes
-- ============================================================================

-- First, we need to create an admin user to be the creator of invitation codes
-- Replace 'your-admin-uuid' with the actual UUID of your admin user
-- You can find this in Supabase Auth users table

-- Create some sample invitation codes
INSERT INTO invitation_codes (code, created_by, expires_at, is_active) 
VALUES 
  ('WELCOME1', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '30 days', true),
  ('STAFF001', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '30 days', true),
  ('MEDTEAM', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '30 days', true),
  ('EFWP2024', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '60 days', true),
  ('CLINIC01', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '30 days', true);

-- Create an email-specific invitation (optional)
INSERT INTO invitation_codes (code, email, created_by, expires_at, is_active) 
VALUES 
  ('JOHN2024', 'john.doe@example.com', (SELECT id FROM auth.users WHERE email = '2646502936yjh@gmail.com'), NOW() + INTERVAL '7 days', true);

-- View created codes
SELECT 
  code,
  email,
  expires_at,
  is_active,
  used_by,
  used_at
FROM invitation_codes
ORDER BY created_at DESC;

-- Success message
SELECT '✅ Invitation codes created! Available codes: WELCOME1, STAFF001, MEDTEAM, EFWP2024, CLINIC01' AS result;