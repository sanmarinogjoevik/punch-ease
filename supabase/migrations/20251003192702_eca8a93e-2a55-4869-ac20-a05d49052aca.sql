-- Allow anonymous users to read user_roles so we can filter admins from employee selector
CREATE POLICY "Public can view user roles"
ON public.user_roles
FOR SELECT
TO anon
USING (true);