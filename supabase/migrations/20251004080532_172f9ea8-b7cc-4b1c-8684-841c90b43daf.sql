-- Update tenant password hash for sanmarino user using Postgres bcrypt
-- This ensures the hash is created with the same algorithm as bcryptjs
UPDATE company_settings 
SET tenant_password_hash = crypt('1234', gen_salt('bf', 10))
WHERE tenant_username = 'sanmarino';