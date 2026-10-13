# NiFlow

Persönliches Planungssystem für Studium, Training und Alltag (mobile-first Web-App).

## Stand (Runde 5: Redesign «Aare»)

- Neues Design mit hellem und dunklem Modus (Einstellungen → Darstellung)
- Übersicht: Als Nächstes, Heute mit freier Zeit, Schnellerfassung, Nächste Tage, Training
- Kalender: Monat, Woche, Tag, Agenda; Termine und Notizen erstellen, bearbeiten, verschieben, löschen
- Eigene Einträge werden in Supabase gespeichert (Tabelle `entries`, nur für dich sichtbar)
- Google Kalender (nur lesen) und Intervals.icu (geplante Trainings, nur lesen) als Datenquellen
- Aufgaben: Heute, Als Nächstes, Diese Woche, Überfällig, Alle, Erledigt; Priorität, Status, Fälligkeit,
  Kategorie, Zeitaufwand, Prüfung; sortieren und filtern; mit Datum auch im Kalender; als Termin einplanen
- Prüfungen: Countdown, Vorbereitungsstand, Lernstoff, Lernaufgaben (mit bestätigtem Lernplan-Vorschlag), Lerntermine
- Wiederkehrende Termine (täglich, werktags, wöchentlich, alle 2 Wochen, monatlich), einzelne Vorkommen auslassen
- Erinnerungen für Termine und Aufgaben (Browser-Benachrichtigung, solange NiFlow geöffnet ist)
- Intervals.icu: geplante und absolvierte Trainings (Dauer, Distanz, Belastung)
- Google Kalender schreiben: eigene Termine landen in einem eigenen Kalender «NiFlow» (nur NiFlow → Google)
- Suche (Strg+K) über Notizen, Termine, Aufgaben und Prüfungen; letzte Notizen auf einen Blick
- Aktivitäten: Vorlagen (Lernen, Vorlesung, Arbeit, Sport …), regelmässige Serien, Wochenplanung pro Kategorie
- Übersicht anpassbar (Bereiche ein-/ausblenden)
- Als App installierbar (PWA: Manifest, Icons, Service Worker)
- Ohne Anmeldung: Demo mit klar gekennzeichneten, erfundenen Daten

Grenzen: keine Push-Erinnerungen bei geschlossener App; Änderungen in Google am Kalender «NiFlow»
werden beim nächsten Abgleich überschrieben; von Strava importierte Aktivitäten gibt Intervals.icu
über die API teilweise nicht heraus.

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
npx supabase functions deploy google-push --no-verify-jwt --use-api
npx supabase functions deploy push --no-verify-jwt --use-api
```

Google Cloud → Google Auth Platform → Datenzugriff: zusätzlich den Bereich
`https://www.googleapis.com/auth/calendar.app.created` hinzufügen, danach in NiFlow neu mit Google anmelden.

Secrets (Supabase → Edge Functions → Secrets): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### Erinnerungen bei geschlossener App (Web Push)

1. `node scripts/vapid-keys.mjs` erzeugt zwei Schlüssel.
2. In Supabase → Edge Functions → Secrets eintragen: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   und `VAPID_SUBJECT` (z. B. `mailto:du@beispiel.ch`).
3. Funktion `push` hochladen (siehe oben). Die Migration `push_cron` ruft sie jede Minute auf (pg_cron + pg_net).
4. In NiFlow: Einstellungen → Erinnerungen → Einschalten. Auf dem iPhone nur aus der Home-Bildschirm-App.

Die App legt die Erinnerungen der nächsten 14 Tage in `push_queue` (Titel, Text, Zeitpunkt).
Die Funktion verschickt fällige Einträge einmal, verschlüsselt nach RFC 8291.

## Aufbau

- `src/domain/`   Logik ohne Oberfläche (Typen, Datum, Planungsregeln, Kalender-Layout, Einträge prüfen)
- `src/data/`     Zugriff auf die eigenen Einträge in Supabase
- `src/sources/`  Datenquellen (eigene Einträge, Google, Intervals.icu, Demo)
- `src/ui/`       Oberfläche (Übersicht, Kalender, Training, Einstellungen)
- `supabase/`     Migrationen und Server-Funktionen
