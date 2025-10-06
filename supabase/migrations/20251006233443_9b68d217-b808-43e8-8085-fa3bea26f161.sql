-- Update shifts foreign key to point to profiles instead of auth.users
-- This enables direct JOIN between shifts and profiles

-- First, drop the existing constraint
ALTER TABLE shifts
DROP CONSTRAINT IF EXISTS shifts_employee_id_fkey;

-- Add new foreign key pointing to profiles.user_id
ALTER TABLE shifts
ADD CONSTRAINT shifts_employee_id_fkey
FOREIGN KEY (employee_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

-- Comment
COMMENT ON CONSTRAINT shifts_employee_id_fkey ON shifts IS 'Links shifts directly to profiles for efficient JOINs';