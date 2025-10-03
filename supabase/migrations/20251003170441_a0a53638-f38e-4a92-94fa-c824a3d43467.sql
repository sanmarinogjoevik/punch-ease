-- Add slug column to companies table
ALTER TABLE public.companies 
ADD COLUMN slug text UNIQUE;

-- Update existing company with a slug (based on name, lowercase, remove spaces)
UPDATE public.companies
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after updating existing records
ALTER TABLE public.companies 
ALTER COLUMN slug SET NOT NULL;

-- Add public SELECT policy for companies (to read slugs without authentication)
CREATE POLICY "Public can view company slugs"
ON public.companies
FOR SELECT
TO anon, authenticated
USING (true);

-- Add public SELECT policy for profiles (to show employees on auth page)
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);