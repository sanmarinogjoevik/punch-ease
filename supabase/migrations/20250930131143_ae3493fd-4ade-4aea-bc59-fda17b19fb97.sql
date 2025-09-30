-- Add postnummer and stad columns to bedriftskunder table
ALTER TABLE public.bedriftskunder
ADD COLUMN postnummer text,
ADD COLUMN stad text;

-- Update existing records to have empty values for new columns
UPDATE public.bedriftskunder
SET postnummer = '',
    stad = ''
WHERE postnummer IS NULL OR stad IS NULL;