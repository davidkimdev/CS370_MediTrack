# MediTrack Deployment Guide

**Complete step-by-step guide for deploying MediTrack to production**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Clone the Repository](#step-1-clone-the-repository)
3. [Step 2: Set Up Supabase (Database)](#step-2-set-up-supabase-database)
4. [Step 3: Configure Environment Variables](#step-3-configure-environment-variables)
5. [Step 4: Test Locally](#step-4-test-locally)
6. [Step 5: Set Up GitHub Repository](#step-5-set-up-github-repository)
7. [Step 6: Deploy to Vercel](#step-6-deploy-to-vercel)
8. [Step 7: Configure Custom Domain (Optional)](#step-7-configure-custom-domain-optional)
9. [Step 8: Post-Deployment Testing](#step-8-post-deployment-testing)
10. [Step 9: Team Handoff](#step-9-team-handoff)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Node.js** installed (v18 or higher) - [Download here](https://nodejs.org/)
- [ ] **Git** installed - [Download here](https://git-scm.com/)
- [ ] **GitHub account** - [Sign up here](https://github.com/signup)
- [ ] **Supabase account** - [Sign up here](https://supabase.com/)
- [ ] **Vercel account** - [Sign up here](https://vercel.com/signup)
- [ ] **Code editor** (VS Code recommended) - [Download here](https://code.visualstudio.com/)

**Estimated Time:** 30-45 minutes

---

## Step 1: Clone the Repository

### Option A: Clone from Existing GitHub Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/CS370_MediTrack_new.git

# Navigate into the project folder
cd CS370_MediTrack_new

# Install dependencies
npm install
```

### Option B: Copy from Local Files

If you're starting from local files without a GitHub repo:

```bash
# Create a new folder for the project
mkdir MediTrack
cd MediTrack

# Copy all files from the current project to this folder
# (Use File Explorer/Finder to copy files)

# Initialize Git
git init

# Install dependencies
npm install
```

---

## Step 2: Set Up Supabase (Database)

### 2.1 Create Supabase Project

1. Go to [https://supabase.com/](https://supabase.com/)
2. Click **"Start your project"** or **"New Project"**
3. Fill in project details:
   - **Project Name:** `meditrack-production` (or your preferred name)
   - **Database Password:** Create a strong password (save this!)
   - **Region:** Choose closest to your clinic location
   - **Pricing Plan:** Start with **Free tier** (can upgrade later)
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to initialize

### 2.2 Get Supabase API Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon in sidebar)
2. Click **API** section
3. You'll see two important values:

   **Project URL:**
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```

   **Anon/Public Key (anon key):**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4IiByb2xlIjoiYW5vbiIsImlhdCI6MTY3ODg5NjAwMCwiZXhwIjoxOTk0NDcyMDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **COPY THESE VALUES** - You'll need them in Step 3

### 2.3 Set Up Database Schema

1. In Supabase dashboard, click **SQL Editor** in sidebar
2. Click **"New query"**
3. Copy and run the following SQL schema:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Users table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic sites table
CREATE TABLE IF NOT EXISTS clinic_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    clinic_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medications table
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    strength TEXT,
    dosage_form TEXT DEFAULT 'tablet',
    category TEXT,
    description TEXT,
    indications TEXT[],
    contraindications TEXT[],
    side_effects TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items table (lot tracking)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    lot_number TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(medication_id, lot_number)
);

-- Dispensing logs table
CREATE TABLE IF NOT EXISTS dispensing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL,
    patient_id TEXT NOT NULL,
    medication_id UUID REFERENCES medications(id),
    medication_name TEXT NOT NULL,
    dose_instructions TEXT NOT NULL,
    lot_number TEXT,
    expiration_date TEXT,
    amount_dispensed TEXT NOT NULL,
    physician_name TEXT,
    student_name TEXT,
    clinic_site TEXT,
    entered_by UUID REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitation codes table
CREATE TABLE IF NOT EXISTS invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    email TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_by UUID REFERENCES user_profiles(id),
    used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    patient_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_inventory_medication ON inventory_items(medication_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lot ON inventory_items(lot_number);
CREATE INDEX IF NOT EXISTS idx_dispensing_date ON dispensing_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispensing_patient ON dispensing_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_medication ON dispensing_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispensing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can access user_profiles" ON user_profiles
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access clinic_sites" ON clinic_sites
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access medications" ON medications
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access inventory_items" ON inventory_items
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access dispensing_logs" ON dispensing_logs
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access invitation_codes" ON invitation_codes
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view audit_logs" ON audit_logs
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dispensing_updated_at BEFORE UPDATE ON dispensing_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

4. Click **"Run"** button
5. You should see **"Success. No rows returned"**
6. Verify tables were created: Click **Table Editor** → You should see all tables listed

### 2.4 Configure Authentication Settings

1. In Supabase dashboard, click **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. Click **URL Configuration**
4. Set **Site URL** to your future domain (you can update this later):
   - For testing: `http://localhost:5173`
   - For production: `https://yourdomain.com` or `https://your-app.vercel.app`
5. Add **Redirect URLs**:
   ```
   http://localhost:5173/**
   https://your-app.vercel.app/**
   https://yourdomain.com/**
   ```
6. Click **Save**

### 2.5 Create First Admin User

1. In Supabase dashboard, click **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email:** Your admin email
   - **Password:** Strong password
   - **Auto Confirm User:** ✅ Check this box
4. Click **"Create user"**
5. Copy the User ID (UUID) that appears
6. Go to **SQL Editor** → **New query**
7. Run this SQL (replace `YOUR_USER_ID` with the UUID you copied):

```sql
INSERT INTO user_profiles (id, email, first_name, last_name, role, is_approved, approved_at)
VALUES (
    'YOUR_USER_ID',
    'your-admin-email@example.com',
    'Admin',
    'User',
    'admin',
    true,
    NOW()
);
```

8. Click **"Run"**
9. You can now log in with this account!

### 2.6 Import Sample Data (Optional)

If you want to import sample medications and data:

1. Go to your project folder
2. Check if `scripts/medications.csv` exists
3. In Supabase dashboard: **Table Editor** → **medications** → **Import data via spreadsheet**
4. Upload `medications.csv`
5. Map columns correctly
6. Click **Import**

---

## Step 3: Configure Environment Variables

### 3.1 Create `.env` File Locally

1. In your project root folder, create a file named `.env`
2. Copy this template and fill in your Supabase credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App Configuration (optional)
VITE_APP_NAME=MediTrack
VITE_APP_ENV=production
```

**⚠️ IMPORTANT:**
- Replace `xxxxxxxxxxxxx` with your actual Supabase project URL
- Replace the `ANON_KEY` with your actual anon key from Step 2.2
- **NO quotes** around values
- **NO spaces** around `=`
- Must start with `VITE_` prefix (required by Vite)

### 3.2 Verify `.env` is in `.gitignore`

1. Open `.gitignore` file
2. Ensure this line exists:
```
.env
.env.local
.env.*.local
```
3. **NEVER commit `.env` file to Git!**

---

## Step 4: Test Locally

### 4.1 Install Dependencies

```bash
npm install
```

### 4.2 Run Development Server

```bash
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4.3 Test the Application

1. Open browser to `http://localhost:5173`
2. You should see the login page
3. Try logging in with the admin account you created in Step 2.5
4. Verify:
   - ✅ Login works
   - ✅ Medications load
   - ✅ Can view dispensing logs
   - ✅ Can dispense medication (if you have inventory)
   - ✅ No console errors

### 4.4 Troubleshooting Local Setup

**Problem:** "Failed to load data from database"
- Check `.env` file has correct Supabase URL and key
- Check `VITE_` prefix is present
- Restart dev server after changing `.env`

**Problem:** "No session found"
- Check Supabase Authentication is enabled
- Check user is created in Supabase dashboard
- Check user profile exists in `user_profiles` table

**Problem:** Console errors about CORS
- Check Supabase API URL is correct
- Check you're using the anon key (not service role key)

---

## Step 5: Set Up GitHub Repository

### 5.1 Create New GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Fill in:
   - **Repository name:** `MediTrack` or `CS370_MediTrack_new`
   - **Description:** "Medication tracking system for EFWP Mobile Clinic"
   - **Visibility:**
     - **Private** (recommended for production)
     - **Public** (if you want open source)
   - **Initialize:** Do NOT check "Add README" (you already have files)
3. Click **"Create repository"**
4. Copy the repository URL that appears

### 5.2 Push Code to GitHub

If you cloned from existing repo:
```bash
# Already set up, just push
git add .
git commit -m "Prepare for deployment"
git push origin main
```

If you're starting fresh:
```bash
# Add all files
git add .

# Create first commit
git commit -m "Initial commit - MediTrack v1.0"

# Add GitHub remote (replace with YOUR repo URL)
git remote add origin https://github.com/YOUR_USERNAME/MediTrack.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 5.3 Verify Upload

1. Go to your GitHub repository page
2. You should see all files uploaded
3. Check that `.env` is **NOT** visible (should be gitignored)

### 5.4 Important Files to Review

Before deploying, check these files are present:
- ✅ `package.json` - Dependencies
- ✅ `vite.config.ts` - Build configuration
- ✅ `index.html` - Entry point
- ✅ `vercel.json` - Vercel configuration (if exists)
- ✅ `.gitignore` - Has `.env` excluded
- ✅ `README.md` - Documentation

---

## Step 6: Deploy to Vercel

### 6.1 Create Vercel Account

1. Go to [https://vercel.com/signup](https://vercel.com/signup)
2. Click **"Continue with GitHub"** (recommended)
3. Authorize Vercel to access your GitHub account
4. Complete sign-up

### 6.2 Import Project from GitHub

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Click **"Import Git Repository"**
3. Find your `MediTrack` repository
4. Click **"Import"**

### 6.3 Configure Project Settings

You'll see the **"Configure Project"** screen:

**1. Project Name:**
```
meditrack-production
```
(or your preferred name - this will be your Vercel subdomain)

**2. Framework Preset:**
```
Vite
```
(Should auto-detect)

**3. Root Directory:**
```
./
```
(Leave as is)

**4. Build Command:**
```
npm run build
```

**5. Output Directory:**
```
dist
```

**6. Install Command:**
```
npm install
```

### 6.4 Add Environment Variables in Vercel

This is **CRITICAL** - Don't skip this!

1. Scroll down to **"Environment Variables"** section
2. Click to expand
3. Add each variable:

**Variable 1:**
- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://xxxxxxxxxxxxx.supabase.co` (your Supabase URL)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

**Variable 2:**
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your anon key)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

**Optional Variable 3:**
- **Name:** `VITE_APP_ENV`
- **Value:** `production`
- **Environments:** ✅ Production only

4. Click **"Deploy"**

### 6.5 Wait for Deployment

1. Vercel will start building your app
2. You'll see a progress screen with logs
3. Wait 2-5 minutes
4. You should see: **"🎉 Congratulations! Your deployment is ready"**

### 6.6 Get Your Live URL

After successful deployment:

1. You'll see your live URL:
   ```
   https://meditrack-production.vercel.app
   ```
2. Click to open and test
3. Copy this URL - you'll need it next

---

## Step 7: Configure Custom Domain (Optional)

### 7.1 If You Have a Custom Domain

1. In Vercel dashboard, go to your project
2. Click **"Settings"** → **"Domains"**
3. Click **"Add"**
4. Enter your domain: `meditrack.yourdomain.com`
5. Follow DNS configuration instructions
6. Add the required DNS records to your domain provider:
   - **Type:** `CNAME`
   - **Name:** `meditrack` (or `@` for root domain)
   - **Value:** `cname.vercel-dns.com`
7. Wait 5-10 minutes for DNS propagation
8. Vercel will auto-issue SSL certificate

### 7.2 Update Supabase Redirect URLs

1. Go to Supabase dashboard
2. Click **Authentication** → **URL Configuration**
3. Add your production URL to **Redirect URLs**:
   ```
   https://meditrack-production.vercel.app/**
   https://meditrack.yourdomain.com/**
   ```
4. Update **Site URL** to production URL
5. Click **Save**

---

## Step 8: Post-Deployment Testing

### 8.1 Test Production Site

Visit your live URL and test:

1. **Homepage Loads:**
   - ✅ No errors in browser console (F12)
   - ✅ UI renders correctly
   - ✅ Colors and styling look correct

2. **Authentication:**
   - ✅ Can log in with admin account
   - ✅ Can create new user account
   - ✅ Can log out
   - ✅ Session persists on page refresh

3. **Medication Features:**
   - ✅ Medications list loads
   - ✅ Can search medications
   - ✅ Can view medication details
   - ✅ Can dispense medication

4. **Inventory Features:**
   - ✅ Can add new lot
   - ✅ Can update lot quantity
   - ✅ Can view expiration dates

5. **Dispensing Logs:**
   - ✅ Can view all dispensing records
   - ✅ Records show correct data
   - ✅ Can filter/search logs

6. **Mobile Responsiveness:**
   - ✅ Test on phone browser
   - ✅ UI adapts to small screen
   - ✅ All features work on mobile

### 8.2 Test PWA Installation (Mobile)

On a mobile device:

1. Visit production URL in mobile browser
2. You should see "Add to Home Screen" prompt
3. Add to home screen
4. Open app from home screen
5. Test offline mode:
   - Turn on airplane mode
   - Open app
   - Should see cached data

### 8.3 Performance Check

1. Open Chrome DevTools (F12)
2. Go to **Lighthouse** tab
3. Click **"Generate report"**
4. Check scores:
   - Performance: Should be >80
   - Accessibility: Should be >90
   - Best Practices: Should be >90
   - SEO: Should be >80

---

## Step 9: Team Handoff

### 9.1 Documentation to Provide

Provide your team with:

1. ✅ **This deployment guide** (`DEPLOYMENT_GUIDE.md`)
2. ✅ **Project README** (`README.md`)
3. ✅ **Database schema** (See Step 2.3 in this guide)
4. ✅ **API documentation** (if you have one)

### 9.2 Credentials to Share Securely

**⚠️ Share these via secure method (1Password, LastPass, encrypted email):**

1. **Supabase Credentials:**
   - Project URL
   - Anon Key
   - Service Role Key (admin only)
   - Database password
   - Admin account login

2. **Vercel Credentials:**
   - Team invitation link (if you created a team)
   - Project URL

3. **GitHub Access:**
   - Add team members as collaborators
   - Set appropriate permissions (Write access)

### 9.3 Access Setup for New Team Members

**For each team member:**

1. **GitHub Access:**
   - Go to repository **Settings** → **Collaborators**
   - Click **"Add people"**
   - Enter their GitHub username
   - Choose permission level:
     - **Write** - Can push code
     - **Admin** - Full access

2. **Vercel Access:**
   - In Vercel dashboard: **Settings** → **Members**
   - Click **"Invite"**
   - Enter their email
   - Choose role:
     - **Member** - Can deploy
     - **Owner** - Full access

3. **Supabase Access:**
   - In Supabase dashboard: **Settings** → **Team**
   - Click **"Invite"**
   - Enter their email
   - Choose role:
     - **Developer** - Can view/edit database
     - **Admin** - Full access

### 9.4 Development Workflow

Teach your team this workflow:

```bash
# 1. Clone repository (first time only)
git clone https://github.com/YOUR_ORG/MediTrack.git
cd MediTrack

# 2. Install dependencies (first time only)
npm install

# 3. Create .env file with Supabase credentials
# (Get from team lead)

# 4. Start development server
npm run dev

# 5. Make changes to code

# 6. Test locally
# Open http://localhost:5173

# 7. Commit changes
git add .
git commit -m "Description of changes"

# 8. Push to GitHub
git push origin main

# 9. Vercel auto-deploys from GitHub
# (Check Vercel dashboard for deployment status)
```

### 9.5 Important Notes for Team

**⚠️ Critical Reminders:**

1. **Never commit `.env` file to Git**
   - Contains sensitive API keys
   - Always in `.gitignore`

2. **Test locally before pushing**
   - Run `npm run dev`
   - Test your changes
   - Check for console errors

3. **Use branches for features**
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git commit -m "Add new feature"
   git push origin feature/new-feature
   # Create Pull Request on GitHub
   ```

4. **Environment variables changes**
   - If you add new env variables:
     - Add to `.env.example` (template)
     - Update in Vercel dashboard
     - Tell team to update their local `.env`

5. **Database schema changes**
   - Test in Supabase **staging project** first
   - Document all SQL changes
   - Apply to production during low-traffic time

---

## Troubleshooting

### Issue 1: Build Fails on Vercel

**Symptoms:**
```
Error: Failed to compile
```

**Solutions:**
1. Check build logs in Vercel dashboard
2. Look for TypeScript errors
3. Run `npm run build` locally to reproduce
4. Fix errors in code
5. Push to GitHub again

### Issue 2: Environment Variables Not Working

**Symptoms:**
- "Failed to load data from database"
- Blank page
- Console error: "Supabase client error"

**Solutions:**
1. Go to Vercel → Project → **Settings** → **Environment Variables**
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Check for typos
4. Must start with `VITE_` prefix
5. **Redeploy** after changing env vars:
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

### Issue 3: Database Connection Fails

**Symptoms:**
- "No rows returned"
- "Failed to fetch"
- Network errors

**Solutions:**
1. Check Supabase project is active (not paused)
2. Verify API URL is correct
3. Check Row Level Security (RLS) policies
4. Verify user is authenticated
5. Check SQL query syntax in Supabase SQL Editor

### Issue 4: Authentication Not Working

**Symptoms:**
- Can't log in
- "Invalid credentials" error
- Redirects fail

**Solutions:**
1. Check Supabase **Authentication** → **URL Configuration**
2. Verify Redirect URLs include production URL
3. Check Site URL matches production domain
4. Clear browser cache and cookies
5. Check user exists in Supabase **Authentication** → **Users**
6. Check user profile exists in `user_profiles` table

### Issue 5: PWA Not Installing on Mobile

**Symptoms:**
- No "Add to Home Screen" prompt
- App doesn't work offline

**Solutions:**
1. Check `manifest.json` exists
2. Verify service worker is registered
3. Test on HTTPS (not HTTP)
4. Check browser console for PWA errors
5. Use Chrome's PWA audit (Lighthouse)

### Issue 6: Slow Performance

**Solutions:**
1. Check database indexes are created (Step 2.3)
2. Enable caching in Vercel:
   - Add `vercel.json`:
   ```json
   {
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ]
   }
   ```
3. Optimize images (compress, use WebP)
4. Check Supabase query performance in dashboard

### Issue 7: CORS Errors

**Symptoms:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Solutions:**
1. Usually not an issue with Supabase
2. Check Supabase URL is correct
3. Make sure you're using anon key (not service role key)
4. Check no proxy/VPN is interfering

### Issue 8: Git Push Rejected

**Symptoms:**
```
! [rejected] main -> main (fetch first)
```

**Solutions:**
```bash
# Pull latest changes
git pull origin main

# Resolve any conflicts

# Push again
git push origin main
```

---

## Quick Reference

### Essential Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Check for errors
npm run lint

# Format code
npm run format
```

### Important URLs

- **Supabase Dashboard:** https://app.supabase.com/
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repository:** https://github.com/YOUR_USERNAME/MediTrack
- **Production App:** https://your-app.vercel.app

### Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Vite Docs:** https://vitejs.dev/
- **React Docs:** https://react.dev/

---

## Maintenance Schedule

### Daily
- ✅ Check deployment status in Vercel
- ✅ Monitor error logs in browser console
- ✅ Check Supabase database size

### Weekly
- ✅ Review user feedback
- ✅ Check for Supabase updates
- ✅ Review GitHub pull requests
- ✅ Test backup/restore procedures

### Monthly
- ✅ Update dependencies: `npm update`
- ✅ Review security advisories
- ✅ Check Supabase storage usage
- ✅ Audit user accounts

### Quarterly
- ✅ Full security audit
- ✅ Performance optimization review
- ✅ User training refresh
- ✅ Disaster recovery test

---

## Contact & Support

For deployment issues:
1. Check this guide first
2. Search GitHub Issues
3. Check Vercel/Supabase status pages
4. Contact team lead
5. Open GitHub issue with:
   - Description of problem
   - Steps to reproduce
   - Screenshots
   - Error messages
   - Environment (browser, OS, etc.)

---

**Last Updated:** November 25, 2025
**Version:** 1.0
**Deployment Status:** ✅ Production Ready
