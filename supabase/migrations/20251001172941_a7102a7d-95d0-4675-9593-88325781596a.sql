-- Add pris and status columns to beställningar table
ALTER TABLE public.beställningar 
ADD COLUMN pris numeric(10,2),
ADD COLUMN status text NOT NULL DEFAULT 'ej_påbörjad';

-- Add comment for status column
COMMENT ON COLUMN public.beställningar.status IS 'Status values: ej_påbörjad, pågående, klar, levererad';

-- Create index for status for better filtering performance
CREATE INDEX idx_beställningar_status ON public.beställningar(status);

-- Create index for created_at for better sorting performance
CREATE INDEX idx_beställningar_created_at ON public.beställningar(created_at DESC);