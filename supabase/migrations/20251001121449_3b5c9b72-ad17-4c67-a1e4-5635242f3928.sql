-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to run auto-temperature-logs function daily at 08:30
SELECT cron.schedule(
  'auto-temperature-logs-daily',
  '30 8 * * *', -- Every day at 08:30
  $$
  SELECT
    net.http_post(
        url:='https://eynulvphjcojanzryfyi.supabase.co/functions/v1/auto-temperature-logs',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bnVsdnBoamNvamFuenJ5ZnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjQ3MTEsImV4cCI6MjA3NDMwMDcxMX0.-1apJAco9qkhLJD8cFgNuk0JUk_ZYs1-h2ZfKW7TlHw"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
