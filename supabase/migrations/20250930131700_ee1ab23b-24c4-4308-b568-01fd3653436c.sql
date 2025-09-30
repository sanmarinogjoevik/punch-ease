-- Add referanse and telefon columns to beställningar table
ALTER TABLE public.beställningar
ADD COLUMN referanse text,
ADD COLUMN telefon text;

-- Add comment to clarify purpose of columns
COMMENT ON COLUMN public.beställningar.referanse IS 'Contact person or reference for the order';
COMMENT ON COLUMN public.beställningar.telefon IS 'Phone number for the contact person';