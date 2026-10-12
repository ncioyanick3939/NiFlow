-- Zugangsdaten für Datenquellen (Intervals.icu API-Schlüssel, später Moodle-Link).
-- Nur die Server-Funktionen dürfen lesen und schreiben. Keine Policy = für die App komplett gesperrt.
create table public.user_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  intervals_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.user_secrets enable row level security;
