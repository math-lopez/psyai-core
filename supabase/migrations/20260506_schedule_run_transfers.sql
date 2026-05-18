create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('run-transfers-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'run-transfers-daily'
);

select cron.schedule(
  'run-transfers-daily',
  '0 0 * * *',
  $$
    select net.http_post(
      url := 'https://PROJECT_REF.supabase.co/functions/v1/run-transfers',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SCHEDULE_SECRET"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
