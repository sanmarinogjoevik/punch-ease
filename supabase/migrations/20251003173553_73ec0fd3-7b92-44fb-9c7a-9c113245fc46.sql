-- Add access_code column to companies table
ALTER TABLE public.companies 
ADD COLUMN access_code TEXT NOT NULL DEFAULT '0000';

-- Update existing companies with unique codes (you can change these later)
UPDATE public.companies 
SET access_code = '1111' 
WHERE slug = 'sanmarino';

-- Add comment
COMMENT ON COLUMN public.companies.access_code IS 'Company access code for initial authentication';

-- The existing RLS policy "Public can view company slugs" already allows public SELECT
-- This is sufficient for validating company slug + access_code from the login form