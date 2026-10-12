-- Freigaben für die Server-Funktionen.
-- Im Projekt ist "Neue Tabellen automatisch anzeigen" ausgeschaltet. Darum bekommt keine Rolle
-- automatisch Rechte auf neue Tabellen, und die Edge Functions (Rolle service_role) scheitern
-- beim Speichern mit "storage_failed". Hier geben wir genau die nötigen Rechte frei.
-- Die geheimen Tabellen bleiben für die App (Rolle authenticated) gesperrt.

grant usage on schema public to service_role, authenticated;

grant select, insert, update, delete on table public.google_tokens to service_role;
grant select, insert, update, delete on table public.user_secrets  to service_role;
grant select, insert, update, delete on table public.calendar_events to service_role;
grant select, insert, update, delete on table public.source_status  to service_role;

-- Die App darf ihre eigenen Termine und den Quellenstatus lesen (RLS-Regeln begrenzen auf die eigenen Zeilen).
grant select on table public.calendar_events to authenticated;
grant select on table public.source_status  to authenticated;
