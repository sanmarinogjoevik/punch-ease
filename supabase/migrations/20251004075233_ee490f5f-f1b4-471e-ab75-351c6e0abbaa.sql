-- First hash the password using bcrypt (we'll use a pre-hashed value for '1234')
-- Bcrypt hash for '1234' with cost 10: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Update or insert company_settings for San Marino Gjøvik
INSERT INTO public.company_settings (
  company_id,
  tenant_username,
  tenant_password_hash,
  company_name
)
VALUES (
  'f41cb9dc-8a2c-4bd1-ac8b-ee687b9ccee7',
  'sanmarino',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'San Marino Gjøvik'
)
ON CONFLICT (company_id) 
DO UPDATE SET
  tenant_username = EXCLUDED.tenant_username,
  tenant_password_hash = EXCLUDED.tenant_password_hash,
  updated_at = now();