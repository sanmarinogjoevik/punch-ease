
select cron.schedule(
  'cleanup-cron-details-daily',
  '0 4 * * *',
  $$
  select
    net.http_post(
        url:='https://eynulvphjcojanzryfyi.supabase.co/functions/v1/cleanup-cron-details',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bnVsdnBoamNvamFuenJ5ZnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjQ3MTEsImV4cCI6MjA3NDMwMDcxMX0.-1apJAco9qkhLJD8cFgNuk0JUk_ZYs1-h2ZfKW7TlHw"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
