-- ============================================
-- FIX FUNCTION SECURITY WARNINGS
-- ============================================
-- 
-- ISSUE: Functions have "role mutable search_path" which is a security risk
-- SOLUTION: Set search_path explicitly on each function
--
-- These warnings appear when functions don't specify their search_path,
-- allowing potential SQL injection via schema manipulation
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire script
-- 3. Click "Run"
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Drop all triggers that depend on functions
-- ============================================

-- Drop all updated_at triggers
DROP TRIGGER IF EXISTS trigger_inventory_new_updated_at ON inventory;
DROP TRIGGER IF EXISTS trigger_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_dispensing_logs_updated_at ON dispensing_logs;
DROP TRIGGER IF EXISTS update_medications_updated_at ON medications;
DROP TRIGGER IF EXISTS update_invitation_codes_updated_at ON invitation_codes;

-- Drop auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================
-- STEP 2: Recreate functions with proper security
-- ============================================

-- Fix ensure_inventory_row function
DROP FUNCTION IF EXISTS public.ensure_inventory_row(uuid, text, date, integer);
CREATE OR REPLACE FUNCTION public.ensure_inventory_row(
  p_medication_id uuid,
  p_lot_number text,
  p_expiration_date date,
  p_quantity integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO inventory (medication_id, lot_number, expiration_date, qty_units, low_stock_threshold)
  VALUES (p_medication_id, p_lot_number, p_expiration_date, p_quantity, 10)
  ON CONFLICT (medication_id, lot_number) DO UPDATE
  SET qty_units = inventory.qty_units + EXCLUDED.qty_units;
END;
$$;

-- Fix update_inventory_new_timestamp function
DROP FUNCTION IF EXISTS public.update_inventory_new_timestamp();
CREATE OR REPLACE FUNCTION public.update_inventory_new_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function  
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'staff',
    false
  );
  RETURN NEW;
END;
$$;

-- Fix merge_lots_by_number function
DROP FUNCTION IF EXISTS public.merge_lots_by_number(text);
CREATE OR REPLACE FUNCTION public.merge_lots_by_number(lot_num text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_qty integer;
  first_id uuid;
BEGIN
  SELECT SUM(qty_units), MIN(id)
  INTO total_qty, first_id
  FROM inventory
  WHERE lot_number = lot_num;

  IF total_qty > 0 THEN
    UPDATE inventory
    SET qty_units = total_qty
    WHERE id = first_id;

    DELETE FROM inventory
    WHERE lot_number = lot_num AND id != first_id;
  END IF;
END;
$$;

-- Fix dispense_from_lot_by_number function
DROP FUNCTION IF EXISTS public.dispense_from_lot_by_number(text, integer);
CREATE OR REPLACE FUNCTION public.dispense_from_lot_by_number(
  lot_num text,
  qty_to_dispense integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE inventory
  SET qty_units = GREATEST(0, qty_units - qty_to_dispense)
  WHERE lot_number = lot_num;
END;
$$;

-- Fix update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 3: Recreate triggers with proper functions
-- ============================================

-- Recreate inventory updated_at trigger
CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_new_timestamp();

-- Recreate auth user trigger (if needed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user()';
  END IF;
END $$;

-- Recreate user_profiles updated_at trigger  
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Recreate dispensing_logs updated_at trigger
CREATE TRIGGER update_dispensing_logs_updated_at
  BEFORE UPDATE ON dispensing_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Recreate medications updated_at trigger (if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medications' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_medications_updated_at
      BEFORE UPDATE ON medications
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- Recreate invitation_codes updated_at trigger (if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitation_codes' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_invitation_codes_updated_at
      BEFORE UPDATE ON invitation_codes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all functions and their search_path settings
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security,
  COALESCE(
    (SELECT string_agg(option, ', ')
     FROM unnest(p.proconfig) as option
     WHERE option LIKE 'search_path=%'),
    'NOT SET'
  ) as search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ============================================
-- EXPECTED RESULT
-- ============================================
-- All functions should show: search_path_setting = 'search_path=public, pg_temp'
-- Security warnings should drop significantly
-- ============================================

