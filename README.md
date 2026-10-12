# NiFlow

Persönliches Planungssystem für Studium, Training und Alltag (mobile-first Web-App).

## Stand (Runde 2)

- Neues Design mit hellem und dunklem Modus (Einstellungen → Darstellung)
- Übersicht: Als Nächstes, Heute mit freier Zeit, Schnellerfassung, Nächste Tage, Training
- Kalender: Monat, Woche, Tag, Agenda; Termine und Notizen erstellen, bearbeiten, verschieben, löschen
- Eigene Einträge werden in Supabase gespeichert (Tabelle `entries`, nur für dich sichtbar)
- Google Kalender (nur lesen) und Intervals.icu (geplante Trainings, nur lesen) als Datenquellen
- Aufgaben: Heute, Als Nächstes, Diese Woche, Überfällig, Alle, Erledigt; Priorität, Status, Fälligkeit,
  Kategorie, Zeitaufwand, Prüfung; sortieren und filtern; mit Datum auch im Kalender; als Termin einplanen
- Prüfungen: Countdown, Vorbereitungsstand, Lernstoff, Lernaufgaben (mit bestätigtem Lernplan-Vorschlag), Lerntermine
- Ohne Anmeldung: Demo mit klar gekennzeichneten, erfundenen Daten

Noch nicht enthalten: wiederkehrende Aktivitäten und Erinnerungen (Runde 3),
Schreiben in Google Kalender (braucht eine zusätzliche Google-Berechtigung).

## Lokal starten

```
npm install
npm run dev
```

## Prüfen

```
npm run check    # Logiktests (Zeiten, Überschneidungen, freie Zeit, Einträge, Intervals)
npm run build    # Typprüfung und Produktions-Build
```

## Datenbank und Server-Funktionen (Supabase)

```
npx supabase db push                                   # Tabellen und Zugriffsregeln
npx supabase functions deploy google-token --no-verify-jwt --use-api
npx supabase functions deploy intervals-events --no-verify-jwt --use-api
```

Secrets (Supabase → Edge Functions → Secrets): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## Aufbau

- `src/domain/`   Logik ohne Oberfläche (Typen, Datum, Planungsregeln, Kalender-Layout, Einträge prüfen)
- `src/data/`     Zugriff auf die eigenen Einträge in Supabase
- `src/sources/`  Datenquellen (eigene Einträge, Google, Intervals.icu, Demo)
- `src/ui/`       Oberfläche (Übersicht, Kalender, Training, Einstellungen)
- `supabase/`     Migrationen und Server-Funktionen
