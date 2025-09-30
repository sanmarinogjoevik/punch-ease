-- Add postboks column to bedriftskunder table
ALTER TABLE public.bedriftskunder
ADD COLUMN postboks text;

-- Add comment to clarify purpose
COMMENT ON COLUMN public.bedriftskunder.postboks IS 'Post office box address for the company';