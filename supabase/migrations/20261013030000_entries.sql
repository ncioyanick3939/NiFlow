-- Eigene Einträge: Termine/Aktivitäten und Notizen. Gehören dem Nutzer, geschützt durch RLS.
-- Aufgaben und Prüfungen bekommen später eigene Tabellen und verweisen auf diese.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('event', 'note')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  category text not null check (category in ('training', 'work', 'study', 'private')),
  all_day boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz,
  priority text check (priority in ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entries_user_start on public.entries (user_id, start_at);

alter table public.entries enable row level security;

create policy "entries select own" on public.entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "entries insert own" on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "entries update own" on public.entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "entries delete own" on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Rechte (im Projekt ist "Neue Tabellen automatisch anzeigen" aus, daher ausdrücklich freigeben).
grant select, insert, update, delete on table public.entries to authenticated;
grant select, insert, update, delete on table public.entries to service_role;
