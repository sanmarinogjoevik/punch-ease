-- Add superadmin RLS policies to all tables
-- This gives superadmin full access without modifying existing policies

-- bedriftskunder
CREATE POLICY "Superadmin full access to bedriftskunder"
ON public.bedriftskunder
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- beställningar
CREATE POLICY "Superadmin full access to beställningar"
ON public.beställningar
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- companies
CREATE POLICY "Superadmin full access to companies"
ON public.companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- company_settings
CREATE POLICY "Superadmin full access to company_settings"
ON public.company_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- equipment
CREATE POLICY "Superadmin full access to equipment"
ON public.equipment
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- profiles
CREATE POLICY "Superadmin full access to profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- shifts
CREATE POLICY "Superadmin full access to shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- temperature_logs
CREATE POLICY "Superadmin full access to temperature_logs"
ON public.temperature_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- time_entries
CREATE POLICY "Superadmin full access to time_entries"
ON public.time_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

-- user_roles
CREATE POLICY "Superadmin full access to user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));