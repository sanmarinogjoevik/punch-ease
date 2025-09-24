-- Delete all users from the auth.users table
-- This will cascade delete related records in profiles, user_roles, time_entries, and shifts tables
DELETE FROM auth.users;