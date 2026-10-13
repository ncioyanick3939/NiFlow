-- Erinnerungen auch bei geschlossener App (Web Push).
-- push_subscriptions: Geräte, die Benachrichtigungen bekommen. Nur die Edge Function "push" schreibt hier.
-- push_queue: anstehende Erinnerungen. Die App berechnet sie (mit richtiger Zeitzone und Serien)
--             und legt sie hier ab, die Edge Function verschickt sie zur richtigen Zeit.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- Keine Regeln für die App: Zugriff nur über die Edge Function (service_role)
grant all on public.push_subscriptions to service_role;

create table public.push_queue (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (char_length(key) <= 300),
  fire_at timestamptz not null,
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 300),
  sent_at timestamptz,
  primary key (user_id, key)
);
create index push_queue_due on public.push_queue (fire_at) where sent_at is null;
alter table public.push_queue enable row level security;
create policy "push_queue select own" on public.push_queue for select to authenticated using (user_id = (select auth.uid()));
create policy "push_queue insert own" on public.push_queue for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push_queue delete own" on public.push_queue for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.push_queue to authenticated;
grant all on public.push_queue to service_role;

-- Ersetzt die noch nicht verschickten Erinnerungen des Nutzers in einem Schritt.
-- Bereits verschickte bleiben (damit nichts doppelt kommt) und werden nach zwei Tagen aufgeräumt.
create or replace function public.replace_push_queue(items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 300 then
    raise exception 'invalid items';
  end if;
  delete from push_queue where user_id = auth.uid() and (sent_at is null or sent_at < now() - interval '2 days');
  insert into push_queue (user_id, key, fire_at, title, body)
  select auth.uid(), i->>'key', (i->>'fire_at')::timestamptz, left(i->>'title', 200), left(coalesce(i->>'body', ''), 300)
  from jsonb_array_elements(items) as i
  where (i->>'fire_at')::timestamptz > now() - interval '5 minutes'
  on conflict (user_id, key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.replace_push_queue(jsonb) to authenticated;
