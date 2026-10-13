-- Wiederholungen, Erinnerungen und Google-Abgleich für eigene Einträge.

alter table public.entries
  add column recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly')),
  add column recurrence_until date,
  -- Ausgelassene Termine einer Serie (lokales Datum)
  add column exdates date[] not null default '{}',
  add column reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  -- Google-Termin im eigenen NiFlow-Kalender (nur gesetzt, wenn der Abgleich aktiv ist)
  add column google_event_id text,
  add column google_synced_at timestamptz;

alter table public.tasks
  add column reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 0 and 10080);

-- Einstellungen für den Google-Abgleich (nur die Server-Funktion liest und schreibt).
alter table public.user_secrets
  add column google_push_enabled boolean not null default false,
  add column google_calendar_id text,
  add column google_last_push_at timestamptz;
