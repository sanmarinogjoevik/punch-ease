-- Add policy to allow anyone to view basic profile information for login
-- This is needed so unauthenticated users can see employee cards on the login page
CREATE POLICY "Anyone can view basic profile info for login"
ON public.profiles
FOR SELECT
TO public
USING (true);