-- Drop the restrictive SELECT policy for employees
DROP POLICY IF EXISTS "Employees can view their own temperature logs" ON public.temperature_logs;

-- Create a new policy that allows all authenticated users to view all temperature logs
CREATE POLICY "All authenticated users can view temperature logs" 
ON public.temperature_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);