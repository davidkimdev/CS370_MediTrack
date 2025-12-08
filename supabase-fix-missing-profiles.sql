-- ============================================
-- Fix Missing User Profiles
-- ============================================
-- This script creates profiles for all auth users
-- that don't have a corresponding user_profiles record.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file contents
-- 5. Click "Run"
-- ============================================

-- Create profiles for all auth users missing a profile
INSERT INTO public.user_profiles (
  id,
  email,
  first_name,
  last_name,
  role,
  is_approved,
  approved_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', 'Unknown'),
  COALESCE(u.raw_user_meta_data->>'last_name', 'User'),
  'staff',
  false,
  NULL,
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.email_confirmed_at IS NOT NULL; -- Only sync confirmed users

-- Show how many profiles were created
SELECT COUNT(*) as profiles_created
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.email_confirmed_at IS NOT NULL;

-- ============================================
-- Verification Query
-- ============================================
-- Run this to see all users and their profile status:
--
-- SELECT
--   u.id,
--   u.email,
--   u.email_confirmed_at,
--   CASE WHEN p.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as status,
--   p.is_approved
-- FROM auth.users u
-- LEFT JOIN public.user_profiles p ON u.id = p.id
-- ORDER BY u.created_at DESC;
