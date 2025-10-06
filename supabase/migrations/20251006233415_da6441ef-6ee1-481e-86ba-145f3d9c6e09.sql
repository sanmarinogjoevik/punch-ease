-- Add foreign key constraints for JOIN optimization

-- Add foreign key from profiles to auth.users (user_id)
-- This enables JOIN between profiles and user_roles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_user_id_fkey
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from shifts to profiles (employee_id -> user_id)
-- This enables JOIN between shifts and profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shifts_employee_id_fkey'
  ) THEN
    ALTER TABLE shifts
    ADD CONSTRAINT shifts_employee_id_fkey
    FOREIGN KEY (employee_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from user_roles to auth.users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Comment: These foreign keys enable efficient JOINs and improve data integrity
COMMENT ON CONSTRAINT profiles_user_id_fkey ON profiles IS 'Links profiles to auth users for JOIN optimization';
COMMENT ON CONSTRAINT shifts_employee_id_fkey ON shifts IS 'Links shifts to auth users (employees) for JOIN optimization';
COMMENT ON CONSTRAINT user_roles_user_id_fkey ON user_roles IS 'Links user roles to auth users for JOIN optimization';