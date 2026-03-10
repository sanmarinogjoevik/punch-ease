
-- Drop all existing restrictive policies on shifts
DROP POLICY IF EXISTS "Admin can manage company shifts" ON shifts;
DROP POLICY IF EXISTS "Employee can view own shifts" ON shifts;
DROP POLICY IF EXISTS "Superadmin can manage all shifts" ON shifts;
DROP POLICY IF EXISTS "Superadmin full access to shifts" ON shifts;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admin can manage company shifts" ON shifts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Employee can view own shifts" ON shifts FOR SELECT TO authenticated
USING (auth.uid() = employee_id AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Superadmin can manage all shifts" ON shifts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
