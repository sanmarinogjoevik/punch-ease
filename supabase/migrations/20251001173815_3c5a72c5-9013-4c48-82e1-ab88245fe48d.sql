-- Remove status column from beställningar table
ALTER TABLE public.beställningar 
DROP COLUMN IF EXISTS status;

-- Drop the status index if it exists
DROP INDEX IF EXISTS idx_beställningar_status;