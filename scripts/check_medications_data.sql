-- Check if medications table has data

-- 1. Count active medications
SELECT COUNT(*) as active_medication_count 
FROM medications 
WHERE is_active = true;

-- 2. Count all medications
SELECT COUNT(*) as total_medication_count 
FROM medications;

-- 3. Show first 5 medications
SELECT id, name, strength, is_active
FROM medications
LIMIT 5;

-- 4. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'medications';

-- 5. Show current policies
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'medications';

