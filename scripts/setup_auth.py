#!/usr/bin/env python3
"""
Authentication System Setup Script
==================================

This script sets up the complete authentication system for MediTrack:
1. Runs database migrations
2. Creates super admin account
3. Verifies setup

Requirements:
- Python 3.7+
- supabase-py package
- Environment variables set in .env.local
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client

# Add parent directory to path to access .env.local
sys.path.insert(0, str(Path(__file__).parent.parent))

# Note: Ensure environment variables are set manually or via .env.local
print("📝 Note: Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment")

# Get Supabase credentials
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_ANON_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

# Admin account details
ADMIN_EMAIL = '2646502936yjh@gmail.com'
ADMIN_PASSWORD = 'Meditrack370'
ADMIN_FIRST_NAME = 'Super'
ADMIN_LAST_NAME = 'Admin'

def create_supabase_client():
    """Create Supabase client with service role key for admin operations."""
    if not SUPABASE_URL:
        print("❌ Error: VITE_SUPABASE_URL not found in environment")
        sys.exit(1)
    
    # Try service role key first, fall back to anon key
    auth_key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    if not auth_key:
        print("❌ Error: No Supabase auth key found in environment")
        print("   Need either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, auth_key)

def run_migration_sql(supabase: Client):
    """Run the database migration SQL."""
    print("📊 Running database migration...")
    
    migration_file = Path(__file__).parent / 'auth_migration.sql'
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    try:
        with open(migration_file, 'r') as f:
            sql_content = f.read()
        
        # Execute the migration
        result = supabase.rpc('exec_sql', {'sql': sql_content})
        print("✅ Database migration completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        print("   You may need to run the SQL manually in Supabase dashboard")
        return False

def create_admin_user(supabase: Client):
    """Create the super admin user account."""
    print("👤 Creating super admin account...")
    
    try:
        # Create admin user via Supabase Auth
        response = supabase.auth.admin.create_user({
            'email': ADMIN_EMAIL,
            'password': ADMIN_PASSWORD,
            'email_confirm': True,  # Skip email confirmation for admin
            'user_metadata': {
                'first_name': ADMIN_FIRST_NAME,
                'last_name': ADMIN_LAST_NAME
            }
        })
        
        if response.user:
            admin_id = response.user.id
            print(f"✅ Admin user created with ID: {admin_id}")
            
            # Update user profile to admin status
            supabase.table('user_profiles').update({
                'role': 'admin',
                'is_approved': True,
                'approved_by': admin_id,
                'approved_at': 'now()'
            }).eq('id', admin_id).execute()
            
            print("✅ Admin profile configured successfully")
            return True
        else:
            print("❌ Failed to create admin user")
            return False
            
    except Exception as e:
        error_msg = str(e)
        if 'already_exists' in error_msg or 'duplicate' in error_msg.lower():
            print("⚠️  Admin user already exists, updating permissions...")
            try:
                # Get existing user
                users = supabase.auth.admin.list_users()
                admin_user = next((u for u in users if u.email == ADMIN_EMAIL), None)
                
                if admin_user:
                    # Update to admin status
                    supabase.table('user_profiles').update({
                        'role': 'admin',
                        'is_approved': True,
                        'approved_by': admin_user.id,
                        'approved_at': 'now()'
                    }).eq('id', admin_user.id).execute()
                    
                    print("✅ Existing admin user updated successfully")
                    return True
            except Exception as update_error:
                print(f"❌ Failed to update existing admin: {update_error}")
        else:
            print(f"❌ Failed to create admin user: {error_msg}")
        
        return False

def verify_setup(supabase: Client):
    """Verify the authentication system is set up correctly."""
    print("🔍 Verifying setup...")
    
    try:
        # Check if tables exist
        tables_result = supabase.table('user_profiles').select('count', count='exact').limit(1).execute()
        invites_result = supabase.table('invitation_codes').select('count', count='exact').limit(1).execute()
        
        print("✅ Tables created successfully:")
        print(f"   📋 user_profiles: {tables_result.count} records")
        print(f"   📋 invitation_codes: {invites_result.count} records")
        
        # Check admin user
        admin_result = supabase.table('user_profiles').select('*').eq('email', ADMIN_EMAIL).execute()
        
        if admin_result.data:
            admin = admin_result.data[0]
            print("✅ Super admin account verified:")
            print(f"   📧 Email: {admin['email']}")
            print(f"   👤 Name: {admin['first_name']} {admin['last_name']}")
            print(f"   🔐 Role: {admin['role']}")
            print(f"   ✅ Approved: {admin['is_approved']}")
        else:
            print("⚠️  Super admin account not found")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        return False

def main():
    """Main setup function."""
    print("=" * 70)
    print("🚀 MEDITRACK AUTHENTICATION SYSTEM SETUP")
    print("=" * 70)
    print()
    
    # Create Supabase client
    try:
        supabase = create_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Run migration (may fail if no service key, that's ok)
    run_migration_sql(supabase)
    
    # Create admin user
    if not create_admin_user(supabase):
        print("❌ Failed to create admin user")
        sys.exit(1)
    
    # Verify setup
    if verify_setup(supabase):
        print()
        print("=" * 70)
        print("🎉 AUTHENTICATION SYSTEM SETUP COMPLETE!")
        print("=" * 70)
        print()
        print("📧 Admin Email:", ADMIN_EMAIL)
        print("🔐 Admin Password:", ADMIN_PASSWORD)
        print()
        print("⚠️  IMPORTANT NEXT STEPS:")
        print("1. Login to the app with admin credentials")
        print("2. Change the admin password immediately")
        print("3. Test user registration and approval workflow")
        print("4. Create invitation codes for authorized users")
        print()
        print("🔗 You can now start the application with: npm run dev")
    else:
        print("❌ Setup verification failed")
        sys.exit(1)

if __name__ == "__main__":
    main()