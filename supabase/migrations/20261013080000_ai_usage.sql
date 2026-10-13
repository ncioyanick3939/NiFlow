-- KI-Planer: zählt die Anfragen pro Person, damit ein Tageslimit gilt (Schutz vor unbeabsichtigten Kosten).
-- Es werden keine Inhalte gespeichert, nur Person und Zeitpunkt. Nur die Server-Funktion darf die Tabelle nutzen.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_usage_user_time on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

grant select, insert, delete on public.ai_usage to service_role;
grant usage, select on sequence public.ai_usage_id_seq to service_role;
