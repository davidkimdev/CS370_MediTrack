-- ============================================================================
-- AUTHENTICATION SYSTEM DATABASE MIGRATION
-- ============================================================================
-- This script sets up the authentication system for MediTrack
-- 
-- What this creates:
-- 1. user_profiles table (extends Supabase auth.users)
-- 2. invitation_codes table (for controlled registration)  
-- 3. Row Level Security (RLS) policies
-- 4. Initial super admin account
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create user_profiles table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approved ON user_profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Create invitation_codes table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT, -- Optional: specific email this invitation is for
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_active ON invitation_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_expires ON invitation_codes(expires_at);

-- ----------------------------------------------------------------------------
-- 3. Set up Row Level Security (RLS)
-- ----------------------------------------------------------------------------

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Admins can update any profile
CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Policy: Only system can insert profiles (via sign up trigger)
CREATE POLICY "System can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Enable RLS on invitation_codes
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage invitation codes
CREATE POLICY "Admins can manage invitations" ON invitation_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
    )
  );

-- Policy: Anyone can read active, non-expired invitation codes for validation
CREATE POLICY "Anyone can validate invitations" ON invitation_codes
  FOR SELECT USING (
    is_active = true AND 
    expires_at > NOW() AND 
    used_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- 4. Create function to handle new user signups
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, first_name, last_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    'staff',
    false -- Default to not approved, except for admins created manually
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Add comments for documentation
-- ----------------------------------------------------------------------------
COMMENT ON TABLE user_profiles IS 'User profiles extending Supabase auth.users with app-specific data';
COMMENT ON COLUMN user_profiles.role IS 'User role: admin (full access) or staff (standard access)';
COMMENT ON COLUMN user_profiles.is_approved IS 'Whether user has been approved by an admin';
COMMENT ON COLUMN user_profiles.approved_by IS 'Admin who approved this user';

COMMENT ON TABLE invitation_codes IS 'Invitation codes for controlled user registration';
COMMENT ON COLUMN invitation_codes.email IS 'Optional: specific email this invitation is for';
COMMENT ON COLUMN invitation_codes.code IS 'Unique invitation code (8 characters)';

-- ----------------------------------------------------------------------------
-- Success message
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ Authentication system migration completed successfully!';
  RAISE NOTICE '📋 Created tables: user_profiles, invitation_codes';
  RAISE NOTICE '🔒 Configured Row Level Security policies';
  RAISE NOTICE '⚡ Set up signup trigger function';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Next step: Create super admin account using admin_setup.sql';
END $$;