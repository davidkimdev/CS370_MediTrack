-- ============================================
-- FIX PUBLIC ACCESS TO MEDICATIONS & INVENTORY
-- ============================================
-- 
-- ISSUE: After enabling RLS, public (non-authenticated) users
--        might be blocked from viewing medications and inventory
--
-- SOLUTION: Ensure public read access policies exist
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- ============================================

BEGIN;

-- ============================================
-- 1. MEDICATIONS - Public read access
-- ============================================

DROP POLICY IF EXISTS "Public read access for active medications" ON medications;
DROP POLICY IF EXISTS "Public read medications" ON medications;
DROP POLICY IF EXISTS "Anyone can view active medications" ON medications;

-- Create consolidated public read policy
CREATE POLICY "Enable read access for everyone" ON medications
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ============================================
-- 2. INVENTORY - Public read access
-- ============================================

DROP POLICY IF EXISTS "Public read access for inventory" ON inventory;
DROP POLICY IF EXISTS "Public read inventory" ON inventory;
DROP POLICY IF EXISTS "Anyone can view inventory" ON inventory;

-- Create consolidated public read policy
CREATE POLICY "Enable read access for everyone" ON inventory
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- 3. DISPENSING_LOGS - Only authenticated staff
-- ============================================

-- This should remain restricted - only for authenticated/approved users
-- (already handled by previous scripts)

-- ============================================
-- VERIFICATION
-- ============================================

-- Show policies for medications and inventory
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('medications', 'inventory')
ORDER BY tablename, policyname;

-- Test query (should work even without authentication)
SELECT COUNT(*) as medication_count FROM medications WHERE is_active = true;
SELECT COUNT(*) as inventory_count FROM inventory;

COMMIT;

-- ============================================
-- EXPECTED RESULT
-- ============================================
-- Both SELECT queries should return counts
-- Policies should show roles: {anon, authenticated}
-- ============================================

