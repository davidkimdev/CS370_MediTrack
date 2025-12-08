# Supabase Setup Guide

This guide will help you configure Supabase correctly for the MediTrack application.

## Problem: Missing User Profiles

If users are appearing in Supabase Auth but not in the "Active Accounts" section of your app, it means their profiles weren't created in the `user_profiles` table.

### Root Cause

When a user signs up:
1. Supabase creates a record in `auth.users`
2. Your app tries to create a record in `user_profiles`
3. **If email confirmation is enabled**, the profile creation might fail due to RLS policies

### Solution: Database Trigger

Set up a database trigger that automatically creates profiles for new users.

## Step 1: Fix Existing Missing Profiles

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `supabase-fix-missing-profiles.sql` from this project
5. Copy the entire contents and paste into the SQL Editor
6. Click **Run**

This will create profiles for all existing auth users that don't have one.

## Step 2: Set Up Auto-Profile Creation Trigger

1. Still in the **SQL Editor**, click **New Query** again
2. Open the file `supabase-trigger-create-profile.sql` from this project
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run**

This creates a trigger that automatically creates a profile whenever a new user signs up.

## Step 3: Configure Email Settings

### Option A: For Production (Recommended)

1. Go to **Authentication** → **Email Templates**
2. Click **"Confirm signup"**
3. Update the email template:
   - Ensure the redirect URL is set correctly
   - The URL should point to your deployed app (e.g., `https://your-app.vercel.app`)

4. Go to **Authentication** → **URL Configuration**
   - Set "Site URL" to your production URL
   - Add your production URL to "Redirect URLs"

### Option B: For Development/Testing Only

If you want to skip email confirmation during development:

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle **OFF** the "Enable email confirmations" option
3. ⚠️ **Remember to turn this back ON before deploying to production!**

## Step 4: Verify Setup

### Test the Trigger

1. Create a test account through your app
2. Go to **Supabase Dashboard** → **Table Editor** → **user_profiles**
3. Verify the profile was created automatically
4. The profile should appear in your app's "Active Accounts" (after admin approval)

### Check Existing Users

Run this query in the SQL Editor to see all users and their profile status:

```sql
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at as auth_created,
  CASE WHEN p.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as status,
  p.is_approved,
  p.role
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
```

## Common Issues

### Issue: Profiles still not appearing

**Check RLS Policies:**
1. Go to **Table Editor** → **user_profiles**
2. Click the **RLS** tab
3. Ensure there's a policy that allows INSERT for authenticated users

**Example policy:**
```sql
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
```

### Issue: Email confirmation emails not working

1. Check **Authentication** → **Email Templates** → "Confirm signup"
2. Verify the redirect URL is correct
3. Check your email provider settings (if using a custom SMTP)
4. For testing, you can disable email confirmation (see Option B above)

### Issue: Old users don't have profiles

Run the `supabase-fix-missing-profiles.sql` script again to sync them.

## Security Notes

- The trigger uses `SECURITY DEFINER` to bypass RLS policies during profile creation
- Only email-confirmed users are synced when fixing missing profiles
- New users default to `role: 'staff'` and `is_approved: false`
- Admins must manually approve users before they can access the system

## Need Help?

If you're still experiencing issues:
1. Check the browser console for errors
2. Check Supabase logs: **Logs** → **Database Logs**
3. Verify the trigger exists: Run `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
