-- Eigene Kategorien ("labels"): eigener Name und eigene Farbe, jeweils einem der vier
-- Grundbereiche zugeordnet (Training, Arbeit, Studium, Privat), damit Auswertungen weiter stimmen.

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color in ('teal', 'sky', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'lime', 'green', 'slate', 'brown')),
  category text not null check (category in ('training', 'work', 'study', 'private')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index labels_user on public.labels (user_id, sort);

alter table public.labels enable row level security;

create policy "labels select own" on public.labels for select to authenticated using (user_id = (select auth.uid()));
create policy "labels insert own" on public.labels for insert to authenticated with check (user_id = (select auth.uid()));
create policy "labels update own" on public.labels for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "labels delete own" on public.labels for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.labels to authenticated;
grant all on public.labels to service_role;

-- Gelöschte Kategorie: Einträge und Aufgaben behalten ihren Grundbereich
alter table public.entries add column label_id uuid references public.labels(id) on delete set null;
alter table public.tasks add column label_id uuid references public.labels(id) on delete set null;

create index entries_label on public.entries (label_id);
create index tasks_label on public.tasks (label_id);
