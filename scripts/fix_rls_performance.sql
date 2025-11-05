-- ============================================
-- FIX RLS PERFORMANCE ISSUES - MEDITRACK
-- ============================================
-- 
-- PROBLEM: auth.uid() is called ONCE PER ROW, not once per query
-- SOLUTION: Wrap in (SELECT auth.uid()) for single evaluation
-- 
-- Expected Performance: 10-100x faster on large tables!
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- 4. Verify in Performance Advisor tab
-- ============================================

-- Fix pattern:
--   BEFORE: WHERE user_id = auth.uid()
--   AFTER:  WHERE user_id = (SELECT auth.uid())

BEGIN;

-- 1. USER_PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

-- 2. INVITATION_CODES
DROP POLICY IF EXISTS "Anyone can view active unused codes" ON invitation_codes;
DROP POLICY IF EXISTS "Admins can create invitation codes" ON invitation_codes;
DROP POLICY IF EXISTS "Admins can view all invitation codes" ON invitation_codes;
DROP POLICY IF EXISTS "Admins can update invitation codes" ON invitation_codes;

CREATE POLICY "Admins manage invitation codes" ON invitation_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin' AND is_approved = true
    )
  );

CREATE POLICY "Public view unused codes" ON invitation_codes
  FOR SELECT USING (is_active = true AND used_at IS NULL);

-- 3. MEDICATIONS
DROP POLICY IF EXISTS "Anyone can view active medications" ON medications;
DROP POLICY IF EXISTS "Approved users can modify medications" ON medications;

CREATE POLICY "Public read medications" ON medications
  FOR SELECT USING (is_active = true);

CREATE POLICY "Approved staff modify medications" ON medications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND is_approved = true
    )
  );

-- 4. INVENTORY  
DROP POLICY IF EXISTS "Anyone can view inventory" ON inventory;
DROP POLICY IF EXISTS "Approved users can modify inventory" ON inventory;

CREATE POLICY "Public read inventory" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "Approved staff modify inventory" ON inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND is_approved = true
    )
  );

-- 5. DISPENSING_LOGS
DROP POLICY IF EXISTS "Users can view dispensing logs" ON dispensing_logs;
DROP POLICY IF EXISTS "Approved users can modify dispensing logs" ON dispensing_logs;

CREATE POLICY "Approved staff access logs" ON dispensing_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid()) AND is_approved = true
    )
  );

-- 6. IMPORT_SESSIONS (if exists)
DROP POLICY IF EXISTS "Users can access their own import_sessions" ON import_sessions;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_sessions') THEN
    EXECUTE 'CREATE POLICY "Users access own sessions" ON import_sessions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))';
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check remaining issues
SELECT 
  tablename,
  policyname,
  LEFT(qual, 100) as policy_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.uid()%' OR qual LIKE '%current_setting(%')
  AND qual NOT LIKE '%(SELECT auth.uid())%';

-- Show all policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;

