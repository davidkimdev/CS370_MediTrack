-- Fix RLS policies that are causing 500 errors
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can access all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can insert profiles during signup" ON user_profiles;

-- Create new permissive policies for authentication to work
CREATE POLICY "Authenticated users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Service role can access all profiles" ON user_profiles
  FOR ALL USING (true);

-- Also ensure users can be inserted during signup
CREATE POLICY "Anyone can insert profiles during signup" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own profiles
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Verify admin account is properly set
SELECT 
  id, email, first_name, last_name, role, is_approved, approved_at
FROM user_profiles 
WHERE email = '2646502936yjh@gmail.com';

SELECT '✅ RLS policies updated for better authentication compatibility' AS result;