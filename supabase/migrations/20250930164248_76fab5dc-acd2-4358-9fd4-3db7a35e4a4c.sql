-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add auto_punch_in flag to shifts table
ALTER TABLE public.shifts
ADD COLUMN auto_punch_in boolean NOT NULL DEFAULT true;

-- Add is_automatic flag to time_entries to track automatic punch-ins
ALTER TABLE public.time_entries
ADD COLUMN is_automatic boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.shifts.auto_punch_in IS 'If true, employee will be automatically punched in at shift start time';
COMMENT ON COLUMN public.time_entries.is_automatic IS 'True if this punch-in was created automatically by the system';

-- Create cron job to run auto-punch-in function every minute
-- This will call the edge function that handles automatic punch-ins
SELECT cron.schedule(
  'auto-punch-in-employees',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://eynulvphjcojanzryfyi.supabase.co/functions/v1/auto-punch-in',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bnVsdnBoamNvamFuenJ5ZnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjQ3MTEsImV4cCI6MjA3NDMwMDcxMX0.-1apJAco9qkhLJD8cFgNuk0JUk_ZYs1-h2ZfKW7TlHw"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);