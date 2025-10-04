-- Remove the public policy for viewing company slugs
DROP POLICY IF EXISTS "Public can view company slugs" ON public.companies;

-- Remove the slug column from companies table
ALTER TABLE public.companies DROP COLUMN IF EXISTS slug;

-- Remove the access_code column from companies table
ALTER TABLE public.companies DROP COLUMN IF EXISTS access_code;