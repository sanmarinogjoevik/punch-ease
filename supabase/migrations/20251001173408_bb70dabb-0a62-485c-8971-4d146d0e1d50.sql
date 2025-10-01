-- Add varor column to beställningar table to store items as JSON
ALTER TABLE public.beställningar 
ADD COLUMN varor jsonb DEFAULT '[]'::jsonb;

-- Add comment for varor column
COMMENT ON COLUMN public.beställningar.varor IS 'Array of items with vara (item name) and pris (price) properties';

-- Remove the pris column since price is now per item in varor
ALTER TABLE public.beställningar 
DROP COLUMN IF EXISTS pris;