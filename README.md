# NiFlow

Persönliche Organisations-App (mobile-first Web-App).
Stand: Ansichten "Heute" und "Woche". Ohne Anmeldung zeigt die App gekennzeichnete Testdaten,
nach "Mit Google verbinden" die echten Termine aus Google Kalender (nur lesend).
Intervals.icu und Moodle folgen.

## Online

Die App wird bei jedem Speichern auf GitHub (Branch `main`) automatisch auf GitHub Pages veröffentlicht.
Die Anleitung dafür steht in `.github/workflows/deploy.yml`.

## Lokal starten (Node.js LTS von https://nodejs.org nötig, oder ein GitHub Codespace)

```
npm install      # Abhängigkeiten laden (nur beim ersten Mal)
npm run dev      # App starten, danach die angezeigte Adresse im Browser öffnen
```

## Prüfen

```
npm run check    # testet die Logik (Überschneidungen, freie Zeit, Fristen, Duplikate, Wochenansicht)
npm run build    # Typprüfung und Produktions-Build
```

## Aufbau

- `src/domain/`   Geschäftslogik ohne Oberfläche (Termin-Typen, Datum, Planungsregeln, Wochenlayout)
- `src/sources/`  Datenquellen. Aktuell nur Testdaten. Google, Intervals.icu und Moodle kommen hier dazu.
- `src/ui/`       Oberfläche (Heute, Woche, Zeitleiste, Navigation)
- `scripts/`      Prüfskripte

## Wichtig

Testdaten sind in der App immer als "Testdaten" gekennzeichnet.
Im Code stehen nur die öffentliche Supabase-Adresse und der Publishable Key (beide öffentlich gedacht).
Geheime Schlüssel (Google Client Secret, Supabase secret/service_role) gehören nie in den Code.

Aktuelle Grenze: Der Google-Zugriff gilt nur solange die Anmeldung frisch ist (ca. 1 Stunde).
Danach "Neu verbinden". Dauerhafte Synchronisierung folgt mit einer Supabase Edge Function.
