-- Add tenant authentication columns to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS tenant_username text UNIQUE,
ADD COLUMN IF NOT EXISTS tenant_password_hash text;

-- Add constraint to ensure tenant_username is lowercase alphanumeric with hyphens only
ALTER TABLE public.company_settings
DROP CONSTRAINT IF EXISTS tenant_username_format;

ALTER TABLE public.company_settings
ADD CONSTRAINT tenant_username_format 
CHECK (tenant_username ~ '^[a-z0-9-]+$');

-- Add comments for clarity
COMMENT ON COLUMN public.company_settings.tenant_username IS 'Unique username for tenant login (lowercase alphanumeric and hyphens only)';
COMMENT ON COLUMN public.company_settings.tenant_password_hash IS 'Bcrypt hashed password for tenant authentication';