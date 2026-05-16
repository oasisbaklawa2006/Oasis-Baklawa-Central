CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bi-monthly-ledger-1st') THEN
    PERFORM cron.unschedule('bi-monthly-ledger-1st');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bi-monthly-ledger-16th') THEN
    PERFORM cron.unschedule('bi-monthly-ledger-16th');
  END IF;
END $$;

SELECT cron.schedule(
  'bi-monthly-ledger-1st',
  '30 3 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/generate-bi-monthly-ledger',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjeHZjYXRzcXFlcnRjbnljdW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzcyNDYsImV4cCI6MjA4OTIxMzI0Nn0.Ns9oRGJ-pp3y-a3cgY2XfiHjGDn_XHwYw84i7eEbLzs"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'bi-monthly-ledger-16th',
  '30 3 16 * *',
  $$
  SELECT net.http_post(
    url := 'https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/generate-bi-monthly-ledger',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjeHZjYXRzcXFlcnRjbnljdW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzcyNDYsImV4cCI6MjA4OTIxMzI0Nn0.Ns9oRGJ-pp3y-a3cgY2XfiHjGDn_XHwYw84i7eEbLzs"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);