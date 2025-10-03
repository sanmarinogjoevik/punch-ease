-- Migration 2: Security functions and RLS policies for multi-tenant isolation

-- Step 1: Create get_user_company_id security definer function
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Step 2: Drop all existing RLS policies (we'll recreate them with company_id checks)

-- profiles
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view basic profile info for login" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- bedriftskunder
DROP POLICY IF EXISTS "Admins can manage all bedriftskunder" ON public.bedriftskunder;
DROP POLICY IF EXISTS "All authenticated users can view bedriftskunder" ON public.bedriftskunder;
DROP POLICY IF EXISTS "Authenticated users can create bedriftskunder" ON public.bedriftskunder;

-- beställningar
DROP POLICY IF EXISTS "Admins can manage all beställningar" ON public.beställningar;
DROP POLICY IF EXISTS "Admins can view all beställningar" ON public.beställningar;
DROP POLICY IF EXISTS "Employees can insert their own beställningar" ON public.beställningar;
DROP POLICY IF EXISTS "Employees can view their own beställningar" ON public.beställningar;

-- shifts
DROP POLICY IF EXISTS "Admins can manage all shifts" ON public.shifts;
DROP POLICY IF EXISTS "Employees can view their own shifts" ON public.shifts;

-- time_entries
DROP POLICY IF EXISTS "Admins can manage all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Employees can insert their own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Employees can view their own time entries" ON public.time_entries;

-- temperature_logs
DROP POLICY IF EXISTS "Admins can manage all temperature logs" ON public.temperature_logs;
DROP POLICY IF EXISTS "All authenticated users can view temperature logs" ON public.temperature_logs;
DROP POLICY IF EXISTS "Employees can insert their own temperature logs" ON public.temperature_logs;

-- equipment
DROP POLICY IF EXISTS "Admins can manage equipment" ON public.equipment;
DROP POLICY IF EXISTS "All authenticated users can view equipment" ON public.equipment;

-- company_settings
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;
DROP POLICY IF EXISTS "All authenticated users can view company settings" ON public.company_settings;

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

-- Step 3: Create new RLS policies with company_id isolation

-- ========== PROFILES ==========
CREATE POLICY "Superadmin can manage all profiles"
  ON public.profiles FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can view company profiles"
  ON public.profiles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admin can update company profiles"
  ON public.profiles FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') 
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Admin can delete company profiles"
  ON public.profiles FOR DELETE
  USING (
    has_role(auth.uid(), 'admin') 
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Employee can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ========== BEDRIFTSKUNDER ==========
CREATE POLICY "Superadmin can manage all bedriftskunder"
  ON public.bedriftskunder FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company bedriftskunder"
  ON public.bedriftskunder FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view company bedriftskunder"
  ON public.bedriftskunder FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can create company bedriftskunder"
  ON public.bedriftskunder FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== BESTÄLLNINGAR ==========
CREATE POLICY "Superadmin can manage all beställningar"
  ON public.beställningar FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company beställningar"
  ON public.beställningar FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view own beställningar"
  ON public.beställningar FOR SELECT
  USING (
    auth.uid() = created_by
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can create own beställningar"
  ON public.beställningar FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== SHIFTS ==========
CREATE POLICY "Superadmin can manage all shifts"
  ON public.shifts FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company shifts"
  ON public.shifts FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view own shifts"
  ON public.shifts FOR SELECT
  USING (
    auth.uid() = employee_id
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== TIME_ENTRIES ==========
CREATE POLICY "Superadmin can manage all time_entries"
  ON public.time_entries FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company time_entries"
  ON public.time_entries FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view own time_entries"
  ON public.time_entries FOR SELECT
  USING (
    auth.uid() = employee_id
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can create own time_entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    auth.uid() = employee_id
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== TEMPERATURE_LOGS ==========
CREATE POLICY "Superadmin can manage all temperature_logs"
  ON public.temperature_logs FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company temperature_logs"
  ON public.temperature_logs FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view company temperature_logs"
  ON public.temperature_logs FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can create own temperature_logs"
  ON public.temperature_logs FOR INSERT
  WITH CHECK (
    auth.uid() = employee_id
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== EQUIPMENT ==========
CREATE POLICY "Superadmin can manage all equipment"
  ON public.equipment FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage company equipment"
  ON public.equipment FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view company equipment"
  ON public.equipment FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== COMPANY_SETTINGS ==========
CREATE POLICY "Superadmin can manage all company_settings"
  ON public.company_settings FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can manage own company_settings"
  ON public.company_settings FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    AND company_id = get_user_company_id(auth.uid())
  );

CREATE POLICY "Employee can view own company_settings"
  ON public.company_settings FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  );

-- ========== USER_ROLES ==========
CREATE POLICY "Superadmin can manage all user_roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can view company user_roles"
  ON public.user_roles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    AND user_id IN (
      SELECT user_id FROM public.profiles 
      WHERE company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "User can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);