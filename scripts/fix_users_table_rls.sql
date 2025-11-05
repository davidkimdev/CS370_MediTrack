-- ============================================
-- FIX PUBLIC.USERS TABLE RLS POLICY
-- ============================================
-- 
-- ISSUE: public.users table has RLS policy "Authenticated users can access users"
--        that calls auth.<function>() directly (per-row evaluation)
--
-- SOLUTION: Wrap with (SELECT auth.<function>()) for single evaluation
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- ============================================

BEGIN;

-- Drop the old policy
DROP POLICY IF EXISTS "Authenticated users can access users" ON public.users;

-- Check if the users table exists and has the expected structure
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    -- Create optimized policy
    -- Note: This assumes users table has an 'id' column that matches auth.uid()
    -- Adjust the policy based on your actual table structure
    
    EXECUTE '
      CREATE POLICY "Authenticated users can access users" ON public.users
        FOR ALL
        TO authenticated
        USING (id = (SELECT auth.uid()))
    ';
    
    RAISE NOTICE 'Fixed RLS policy on public.users table';
  ELSE
    RAISE NOTICE 'public.users table does not exist - skipping';
  END IF;
END $$;

COMMIT;

-- Verify
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users';

