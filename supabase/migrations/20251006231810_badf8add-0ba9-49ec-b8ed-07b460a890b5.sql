-- ============================================
-- FIX: Säkerställ företagsisolering i RLS policies
-- ============================================
-- Detta fixar problemet där admins kan se data från andra företag
-- genom att ta bort eventuella gamla policies och skapa korrekta

-- ============================================
-- 1. PROFILES - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete company profiles" ON public.profiles;

CREATE POLICY "Admin can view company profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admin can update company profiles"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Admin can delete company profiles"
ON public.profiles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 2. USER_ROLES - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can view company user_roles" ON public.user_roles;

CREATE POLICY "Admin can view company user_roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id IN (
    SELECT user_id FROM public.profiles 
    WHERE company_id = get_user_company_id(auth.uid())
  )
);

-- ============================================
-- 3. SHIFTS - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admin can manage company shifts" ON public.shifts;

CREATE POLICY "Admin can manage company shifts"
ON public.shifts
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 4. TIME_ENTRIES - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Admin can manage company time_entries" ON public.time_entries;

CREATE POLICY "Admin can manage company time_entries"
ON public.time_entries
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 5. TEMPERATURE_LOGS - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all temperature_logs" ON public.temperature_logs;
DROP POLICY IF EXISTS "Admin can manage company temperature_logs" ON public.temperature_logs;

CREATE POLICY "Admin can manage company temperature_logs"
ON public.temperature_logs
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 6. EQUIPMENT - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admin can manage company equipment" ON public.equipment;

CREATE POLICY "Admin can manage company equipment"
ON public.equipment
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 7. BEDRIFTSKUNDER - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all bedriftskunder" ON public.bedriftskunder;
DROP POLICY IF EXISTS "Admin can manage company bedriftskunder" ON public.bedriftskunder;

CREATE POLICY "Admin can manage company bedriftskunder"
ON public.bedriftskunder
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 8. BESTÄLLNINGAR - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can view all beställningar" ON public.beställningar;
DROP POLICY IF EXISTS "Admins can manage all beställningar" ON public.beställningar;
DROP POLICY IF EXISTS "Admin can manage company beställningar" ON public.beställningar;

CREATE POLICY "Admin can manage company beställningar"
ON public.beställningar
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);

-- ============================================
-- 9. COMPANY_SETTINGS - Ta bort gamla och skapa nya
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admin can manage own company_settings" ON public.company_settings;

CREATE POLICY "Admin can manage own company_settings"
ON public.company_settings
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = get_user_company_id(auth.uid())
);