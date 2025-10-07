-- Remove foreign key constraints that reference auth.users

-- Drop foreign key from profiles to auth.users
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE profiles
    DROP CONSTRAINT profiles_user_id_fkey;
  END IF;
END $$;

-- Drop foreign key from shifts to auth.users
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shifts_employee_id_fkey'
  ) THEN
    ALTER TABLE shifts
    DROP CONSTRAINT shifts_employee_id_fkey;
  END IF;
END $$;

-- Drop foreign key from user_roles to auth.users
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE user_roles
    DROP CONSTRAINT user_roles_user_id_fkey;
  END IF;
END $$;