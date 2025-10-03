-- Update user role to superadmin for specific email
-- Note: User must first register via the auth page with this email

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'wills.mansour@live.se';

  -- If user exists, update their role to superadmin
  IF target_user_id IS NOT NULL THEN
    -- Update or insert the superadmin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'superadmin')
    ON CONFLICT (user_id, role) 
    DO UPDATE SET role = 'superadmin';
    
    RAISE NOTICE 'User % has been granted superadmin role', target_user_id;
  ELSE
    RAISE NOTICE 'User with email wills.mansour@live.se not found. Please register first via /#/sanmarinogjvik/auth';
  END IF;
END $$;