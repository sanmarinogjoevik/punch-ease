-- Add policy to allow anyone to read user roles for filtering purposes
-- This is needed so unauthenticated users can see which profiles are admins on the login page
CREATE POLICY "Anyone can view user roles"
ON public.user_roles
FOR SELECT
TO public
USING (true);