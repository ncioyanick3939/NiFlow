# NiFlow

Persönliches Planungssystem für Studium, Training und Alltag (mobile-first Web-App).

## Stand (Runde 7: Redesign «Swiss Editorial»)

- Design «Swiss Editorial»: Papier `#F4F1EA`, Tinte `#1B1B18`, Signalrot `#E4412B` nur für aktiv/jetzt/Hauptaktion,
  1-px-Linien statt Karten, Rundungen höchstens 6 px, Instrument Sans + JetBrains Mono (Zeiten, Daten, Zahlen),
  Schriften lokal mitgeliefert (kein Abruf bei Google), dunkler Modus in Anthrazit, «Bewegung reduzieren» respektiert
- Alle Tokens zentral: `src/index.css` (Farben als CSS-Variablen) und `tailwind.config.js` (Rundungen, Schatten, Schriften)
- Kalender per Ziehen: verschieben, Länge ändern, über freie Zeit aufziehen, im Monat auf andere Tage ziehen (Maus/Stift)
- Eigene Kategorien (Name, Farbe, Grundbereich)
- Erinnerungen auch bei geschlossener App (Web Push, auf dem iPhone über den Home-Bildschirm)
- Heller und dunkler Modus (Einstellungen → Darstellung)
- Übersicht: Als Nächstes, Heute mit freier Zeit, Schnellerfassung, Nächste Tage, Training
- Kalender: Monat, Woche, Tag, Agenda; Termine und Notizen erstellen, bearbeiten, verschieben, löschen
- Eigene Einträge werden in Supabase gespeichert (Tabelle `entries`, nur für dich sichtbar)
- Google Kalender (nur lesen) und Intervals.icu (geplante Trainings, nur lesen) als Datenquellen
- Aufgaben: Heute, Als Nächstes, Diese Woche, Überfällig, Alle, Erledigt; Priorität, Status, Fälligkeit,
  Kategorie, Zeitaufwand, Prüfung; sortieren und filtern; mit Datum auch im Kalender; als Termin einplanen
- Prüfungen: Countdown, Vorbereitungsstand, Lernstoff, Lernaufgaben (mit bestätigtem Lernplan-Vorschlag), Lerntermine
- Wiederkehrende Termine (täglich, werktags, wöchentlich, alle 2 Wochen, monatlich), einzelne Vorkommen auslassen
- Erinnerungen für Termine und Aufgaben (in der App und per Push)
- Intervals.icu: geplante und absolvierte Trainings (Dauer, Distanz, Belastung)
- Google Kalender schreiben: eigene Termine landen in einem eigenen Kalender «NiFlow» (nur NiFlow → Google)
- Suche (Strg+K) über Notizen, Termine, Aufgaben und Prüfungen; letzte Notizen auf einen Blick
- Aktivitäten: Vorlagen (Lernen, Vorlesung, Arbeit, Sport …), regelmässige Serien, Wochenplanung pro Kategorie
- Übersicht anpassbar (Bereiche ein-/ausblenden)
- Als App installierbar (PWA: Manifest, Icons, Service Worker)
- Ohne Anmeldung: Demo mit klar gekennzeichneten, erfundenen Daten

Grenzen: Push braucht die VAPID-Schlüssel in Supabase und NiFlow muss ab und zu geöffnet werden (Erinnerungen für 14 Tage im Voraus); Änderungen in Google am Kalender «NiFlow»
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
npx supabase functions deploy plan-assistant --no-verify-jwt --use-api
npx supabase functions deploy delete-account --no-verify-jwt --use-api
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

### KI-Planer (Planungs-Assistent)

Die App schickt Titel, Zeiten, Kategorien und Prüfungsthemen der nächsten 14 Tage (keine Notizen) an die
Funktion `plan-assistant`. Diese fragt die Anthropic-API und liefert Vorschläge zurück. Die App legt erst nach
deiner Bestätigung etwas an.

1. API-Schlüssel auf https://console.anthropic.com erstellen (Abrechnung pro Nutzung, Ausgabenlimit setzen).
2. Den Schlüssel NUR als Secret setzen, nie in Code oder Chat:
   `npx supabase secrets set ANTHROPIC_API_KEY=...` (oder Supabase → Edge Functions → Secrets).
3. Optional: `AI_MODEL` (Standard `claude-sonnet-5-5`) und `AI_DAILY_LIMIT` (Standard 40 Anfragen pro 24 Stunden).
4. Migration `ai_usage` einspielen (`npx supabase db push`) und die Funktion hochladen (siehe oben).

## Anmeldung mit E-Mail, Konto löschen, Rechtstexte

- E-Mail-Anmeldung braucht in Supabase → Authentication → Providers → Email (standardmässig an). Unter Authentication → URL Configuration
  müssen `Site URL` und `Redirect URLs` die App-Adresse enthalten (`https://<name>.github.io/NiFlow/`), sonst führen die Links in den E-Mails ins Leere.
- Die eingebauten Supabase-E-Mails sind stark begrenzt (wenige pro Stunde). Für echte Nutzer: Authentication → SMTP Settings mit eigenem Mailanbieter.
- «Konto löschen» ruft die Funktion `delete-account` auf. Alle Tabellen hängen per `on delete cascade` am Konto.
- `public/datenschutz.html` und `public/nutzungsbedingungen.html` sind Entwürfe. Alle gelb markierten Stellen ausfüllen und prüfen lassen.
- Sign in with Apple (Pflicht im App Store, sobald Google als Anmeldung angeboten wird) folgt, sobald das Apple-Developer-Konto besteht.

## Aufbau

- `src/domain/`   Logik ohne Oberfläche (Typen, Datum, Planungsregeln, Kalender-Layout, Einträge prüfen)
- `src/data/`     Zugriff auf die eigenen Einträge in Supabase
- `src/sources/`  Datenquellen (eigene Einträge, Google, Intervals.icu, Demo)
- `src/ui/`       Oberfläche (Übersicht, Kalender, Training, Einstellungen)
- `supabase/`     Migrationen und Server-Funktionen
