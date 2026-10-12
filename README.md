# Fokus

Persönliche Organisations-App (mobile-first Web-App). Stand: Schritt 1, Design, Navigation und Ansicht "Heute".

## Starten (einmalig Node.js installieren: https://nodejs.org, Version LTS)

```
npm install      # Abhängigkeiten laden (nur beim ersten Mal)
npm run dev      # App starten, danach die angezeigte Adresse im Browser öffnen
```

Auf dem Smartphone testen: Handy und Computer im selben WLAN, dann `npm run dev -- --host` starten
und die "Network"-Adresse am Handy öffnen.

## Prüfen

```
npm run check    # testet die Logik (Überschneidungen, freie Zeit, Fristen, Duplikate)
npm run build    # Typprüfung und Produktions-Build
```

## Aufbau

- `src/domain/`   Geschäftslogik ohne Oberfläche (Termin-Typen, Datum, Planungsregeln)
- `src/sources/`  Datenquellen. Aktuell nur Testdaten. Google, Intervals.icu und Moodle kommen hier dazu.
- `src/ui/`       Oberfläche (Heute, Woche, Navigation)
- `scripts/`      Prüfskripte

## Wichtig

Alle sichtbaren Termine sind aktuell **Testdaten** und in der App entsprechend gekennzeichnet.
Es sind keine Zugangsdaten im Code gespeichert.
