-- Remove employee role for superadmin users
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role = 'superadmin'
)
AND role = 'employee';