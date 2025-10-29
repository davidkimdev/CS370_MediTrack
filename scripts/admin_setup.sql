-- ============================================================================
-- SUPER ADMIN ACCOUNT SETUP
-- ============================================================================
-- This script creates the initial super admin account
-- Email: 2646502936yjh@gmail.com
-- Password: Meditrack370
-- 
-- ⚠️  SECURITY NOTE: Change the password after first login!
-- ⚠️  This account will have full administrative privileges
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create the super admin user in auth.users
-- ----------------------------------------------------------------------------
-- Note: This will be done through the Supabase Auth API, not direct SQL
-- The SQL below is for reference and cleanup if needed

-- Clean up any existing admin account (if rerunning)
DELETE FROM user_profiles WHERE email = '2646502936yjh@gmail.com';

-- ----------------------------------------------------------------------------
-- The actual admin creation will be done via API call
-- This file serves as documentation and reference
-- ----------------------------------------------------------------------------

-- After the admin user is created via auth, update their profile
-- This will run automatically via the trigger, but we ensure admin status
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Find the admin user (will be created via API)
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = '2646502936yjh@gmail.com' 
    LIMIT 1;
    
    -- If user exists, make sure they're an approved admin
    IF admin_user_id IS NOT NULL THEN
        UPDATE user_profiles 
        SET 
            role = 'admin',
            is_approved = true,
            approved_by = admin_user_id, -- Self-approved
            approved_at = NOW()
        WHERE id = admin_user_id;
        
        RAISE NOTICE '✅ Super admin account configured successfully!';
        RAISE NOTICE '📧 Email: 2646502936yjh@gmail.com';
        RAISE NOTICE '🔐 Password: Meditrack370';
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  IMPORTANT: Change password after first login!';
        RAISE NOTICE '🎯 This account has full administrative privileges';
    ELSE
        RAISE NOTICE '⚠️  Admin user not found. Run the API creation step first.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Verify admin account setup
-- ----------------------------------------------------------------------------
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.is_approved,
    up.created_at,
    au.email_confirmed_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.email = '2646502936yjh@gmail.com';

-- Show admin capabilities
SELECT 
    'Super Admin Permissions' as info,
    'Can approve/reject users' as permission_1,
    'Can create invitation codes' as permission_2,
    'Can manage all user accounts' as permission_3,
    'Can access admin panel' as permission_4;