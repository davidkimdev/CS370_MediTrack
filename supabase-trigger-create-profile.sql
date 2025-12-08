-- ============================================
-- Database Trigger: Auto-create user profile
-- ============================================
-- This trigger automatically creates a user_profiles record
-- whenever a new user signs up via Supabase Auth.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file contents
-- 5. Click "Run"
-- ============================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new profile for the user
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
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    'staff',
    false,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Ignore if profile already exists

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- ============================================
-- Verification Query (run this after the above)
-- ============================================
-- Run this to verify the trigger was created:
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
