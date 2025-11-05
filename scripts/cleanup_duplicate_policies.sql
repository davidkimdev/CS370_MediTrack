-- ============================================
-- CLEANUP DUPLICATE RLS POLICIES
-- ============================================
-- Remove old/duplicate policies after running fix_rls_performance.sql
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor  
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- ============================================

BEGIN;

-- Remove old dispensing_logs policy
DROP POLICY IF EXISTS "Authenticated users can access dispensing_logs" ON dispensing_logs;

-- Remove duplicate user_profiles policies (keep the ones with "their own")
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Remove old invitation_codes policies (keep the consolidated ones)
DROP POLICY IF EXISTS "Code management" ON invitation_codes;
DROP POLICY IF EXISTS "Anyone can validate invitations" ON invitation_codes;
DROP POLICY IF EXISTS "Admins can insert invitation codes" ON invitation_codes;

-- Keep only:
-- - "Admins manage invitation codes" (ALL)
-- - "Public view unused codes" (SELECT)

COMMIT;

-- Verify cleanup
SELECT 
  tablename,
  policyname,
  cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- ============================================
-- EXPECTED RESULT AFTER CLEANUP:
-- ============================================
-- dispensing_logs: 1 policy (Approved staff access logs)
-- inventory: 2 policies (Public read, Approved staff modify)
-- invitation_codes: 2 policies (Admins manage, Public view unused)
-- medications: 2 policies (Public read, Approved staff modify)
-- user_profiles: 3 policies (view own, update own, insert own)
-- ============================================

