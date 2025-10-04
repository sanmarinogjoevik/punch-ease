-- Update handle_new_user() function to use dummy company for all new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email, company_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email,
    '00000000-0000-0000-0000-000000000000' -- Dummy company for all users
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

-- Update superadmin role for willysmansour@superadmin.com if user exists
UPDATE public.user_roles
SET role = 'superadmin'::app_role
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'willysmansour@superadmin.com'
);