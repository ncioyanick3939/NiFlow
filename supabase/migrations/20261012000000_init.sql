-- NiFlow: Grundstruktur. Jede Tabelle gehört einem Benutzer (user_id) und ist per RLS geschützt.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('google','intervals','moodle')),
  external_id text not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  category text not null check (category in ('training','work','study','private')),
  kind text not null default 'event' check (kind in ('event','deadline','exam')),
  intensity text,
  synced_at timestamptz not null default now(),
  -- verhindert doppelte Termine bei jeder Synchronisierung
  unique (user_id, source, external_id)
);

create table public.source_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  primary key (user_id, source)
);

-- Google-Token: nur der Server (Edge Function) darf lesen, kein Zugriff aus der App.
create table public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.source_status  enable row level security;
alter table public.google_tokens  enable row level security;

create policy "own events read" on public.calendar_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own status read" on public.source_status
  for select to authenticated using (user_id = (select auth.uid()));
-- google_tokens: bewusst keine Policy = für die App komplett gesperrt.
