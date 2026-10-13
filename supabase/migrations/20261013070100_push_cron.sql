-- Jede Minute die Edge Function "push" anstossen, damit fällige Erinnerungen verschickt werden.
-- Die Aktion "send" verschickt nur, was wirklich fällig ist, und jede Erinnerung nur einmal.
-- Deshalb braucht der Aufruf kein Geheimnis.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('niflow-push') where exists (select 1 from cron.job where jobname = 'niflow-push');

select cron.schedule(
  'niflow-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://rfhgqswrwceutvmeolfk.supabase.co/functions/v1/push',
    body := '{"action":"send"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
