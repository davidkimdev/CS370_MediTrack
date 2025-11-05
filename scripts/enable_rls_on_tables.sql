-- ============================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================
-- 
-- CRITICAL: This enables RLS enforcement on tables
-- Without this, the policies exist but aren't enforced!
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor  
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- ============================================

-- Enable RLS on all main tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispensing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on import_sessions if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_sessions') THEN
    EXECUTE 'ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Enable RLS on audit_logs if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    EXECUTE 'ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Enable RLS on users if it exists (legacy table)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_profiles', 
    'medications', 
    'inventory', 
    'dispensing_logs', 
    'invitation_codes',
    'import_sessions',
    'audit_logs',
    'users'
  )
ORDER BY tablename;

-- Expected: rls_enabled should be TRUE for all tables

-- ============================================
-- IMPORTANT NOTES
-- ============================================
-- After running this:
-- 1. Security warnings should drop from 27 to ~0
-- 2. Queries will use RLS policies (much faster!)
-- 3. App should load in 1-3 seconds instead of timing out
-- ============================================

