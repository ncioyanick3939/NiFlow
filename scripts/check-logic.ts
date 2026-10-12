// Einfache Prüfung der Geschäftslogik. Ausführen mit: npm run check
import { addDays, atTime, startOfWeek } from '../src/domain/dateUtils'
import {
  busyMinutes,
  deadlineUrgency,
  eventsForDay,
  findFreeSlots,
  findOverlaps,
  isHeavyDay,
  nextEvent,
} from '../src/domain/schedule'
import { categoryMinutes, layoutDay, summarizeWeek, weekDays } from '../src/domain/weekLayout'
import { createTestEvents } from '../src/sources/testSource'
import { SOURCES, loadAllSources } from '../src/sources'
import type { EventSource } from '../src/sources/types'
import { categorize } from '../src/sources/categorize'
import { mapIntervalsEvent } from '../src/sources/intervals'
import { NotConfigured } from '../src/sources/intervalsSource'
import { mapGoogleEvent } from '../src/sources/googleCalendar'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' – ' + detail : ''}`)
  if (!ok) failed++
}

// Fester Zeitpunkt: Montag 12.10.2026, 20:17
const now = new Date(2026, 9, 12, 20, 17)
const events = createTestEvents(now)
const monday = startOfWeek(now)
const day = (n: number) => addDays(monday, n)

// 1. Überschneidung am Mittwoch
const wed = eventsForDay(events, day(2))
const overlaps = findOverlaps(wed.timed)
check('Mittwoch: 2 Vorlesungen überschneiden sich', overlaps.size === 2, `${overlaps.size} Termine`)

// 2. Montag und Dienstag ohne Überschneidung
check('Montag ohne Überschneidung', findOverlaps(eventsForDay(events, day(0)).timed).size === 0)

// 3. Stark belegter Tag am Donnerstag (10.5 h + 2.5 h)
const thuBusy = busyMinutes(eventsForDay(events, day(3)).timed, day(3))
check('Donnerstag ist stark belegt (>10 h)', isHeavyDay(thuBusy), `${thuBusy} min`)
const monBusy = busyMinutes(eventsForDay(events, day(0)).timed, day(0))
check('Montag ist nicht stark belegt', !isHeavyDay(monBusy), `${monBusy} min`)

// 4. Überschneidungen werden bei der Belegung nicht doppelt gezählt (Mittwoch 08:15–11:30 + 12:30–18:30 + 19:00–20:30)
const wedBusy = busyMinutes(wed.timed, day(2))
check('Mittwoch: Belegung ohne Doppelzählung', wedBusy === 195 + 360 + 90, `${wedBusy} min`)

// 5. Ganztägiger Termin am Freitag
const fri = eventsForDay(events, day(4))
check('Freitag: ganztägiger Termin erkannt', fri.allDay.length === 1)
const friSlots = findFreeSlots(fri, day(4), now)
check('Freitag: freie Zeit als unsicher markiert', friSlots.length > 0 && friSlots.every((s) => s.uncertain))

// 6. Kein Lernblock nach intensivem Training (Samstag Ausfahrt endet 12:00, hoch -> frühestens 13:00)
const sat = eventsForDay(events, day(5))
const satSlots = findFreeSlots(sat, day(5), now)
const afterRide = satSlots.find((s) => s.start.getHours() === 12)
check('Samstag: Lücke nach intensivem Training gefunden', !!afterRide)
check(
  'Samstag: Lernblock beginnt frühestens 1 h nach intensivem Training',
  !!afterRide?.study && afterRide.study.start >= atTime(day(5), 13, 0),
  afterRide?.study ? afterRide.study.start.toTimeString().slice(0, 5) : 'kein Lernblock',
)

// 7. Kein Lernblock nach 21:30 (Montag früh, damit nichts von "jetzt" abgeschnitten wird)
const earlyNow = new Date(2026, 9, 12, 5, 0)
const sun = eventsForDay(events, day(6))
const sunSlots = findFreeSlots(sun, day(6), earlyNow)
check(
  'Kein Lernblock endet nach 21:30',
  sunSlots.every((s) => !s.study || s.study.end <= atTime(day(6), 21, 30)),
)

// 8. Lücken unter 90 min sind kein Lernfenster
check(
  'Lernfenster sind mindestens 90 min lang',
  [...satSlots, ...sunSlots].every((s) => !s.study || (s.study.end.getTime() - s.study.start.getTime()) / 60000 >= 90),
)

// 9. Heute (20:17): freie Zeit beginnt frühestens jetzt
const mon = eventsForDay(events, day(0))
const monSlots = findFreeSlots(mon, day(0), now)
check('Heute: keine freie Zeit in der Vergangenheit', monSlots.every((s) => s.start >= now))

// 10. Frist-Hervorhebung: Abgabe Dienstag 23:59, jetzt Montag 20:17 -> unter 48 h
const due = events.find((e) => e.externalId === 'tu-due')!
check('Abgabe in 27 h: Hervorhebung 48 h', deadlineUrgency(due, now) === 'h48')
check('Abgabe in 2 h: Hervorhebung 3 h', deadlineUrgency(due, new Date(2026, 9, 13, 21, 59)) === 'h3')
check('Abgabe in 10 Tagen: keine Hervorhebung', deadlineUrgency(due, new Date(2026, 9, 3, 12, 0)) === null)
check('Abgabe in der Vergangenheit: keine Hervorhebung', deadlineUrgency(due, new Date(2026, 9, 14, 12, 0)) === null)
check('Normaler Termin wird nie hervorgehoben', deadlineUrgency(events[0], now) === null)

// 11. Nächster Termin
const next = nextEvent(events, now)
check('Nächster Termin ist die Abgabe oder früher am Dienstag', !!next && next.start > now, next?.title)

// 12. Termin ohne Ende erscheint nur an seinem Starttag
check('Termin ohne Ende nur am Starttag', eventsForDay(events, day(1)).timed.some((e) => e.id === due.id) &&
  !eventsForDay(events, day(2)).timed.some((e) => e.id === due.id))

// 13. Konsistenz Heute/Woche: jeder Termin erscheint an seinem Tag
let missing = 0
for (const e of events) {
  const d = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate())
  const dd = eventsForDay(events, d)
  if (![...dd.timed, ...dd.allDay].some((x) => x.id === e.id)) missing++
}
check('Jeder Termin erscheint an seinem Tag', missing === 0, `${missing} fehlen`)

// 14. Zeitwechsel Ende Oktober: 25.10.2026 hat 25 Stunden
const dstDay = new Date(2026, 9, 25)
const dstNext = addDays(dstDay, 1)
check('Sommerzeit-Ende: Tag hat 25 Stunden', (dstNext.getTime() - dstDay.getTime()) / 3600000 === 25 || process.env.TZ !== 'Europe/Zurich')

// 15. Duplikate und Quellenfehler
const dupSource: EventSource = {
  id: 'google',
  label: 'Google Kalender',
  isDemo: false,
  load: async () => [events[0], events[0], { ...events[0], title: 'Aktualisiert' }].map((e) => ({ ...e, id: 'google:x', source: 'google' as const })),
}
const failing: EventSource = { id: 'moodle', label: 'Moodle', isDemo: false, load: async () => { throw new Error('Verbindung abgelehnt') } }
const res = await loadAllSources([...SOURCES, dupSource, failing], now)
check('Duplikate (gleiche ID) werden zusammengeführt', res.events.filter((e) => e.id === 'google:x').length === 1)
check('Aktualisierung überschreibt alten Eintrag', res.events.find((e) => e.id === 'google:x')?.title === 'Aktualisiert')
check('Ausgefallene Quelle meldet Fehler', res.states.find((s) => s.id === 'moodle')?.status === 'error')
check('Andere Quellen funktionieren trotzdem', res.events.some((e) => e.source === 'test'))

// 16. Leere Daten
const emptyDay = eventsForDay([], day(0))
check('Leere Daten: kein Absturz', emptyDay.timed.length === 0 && findFreeSlots(emptyDay, day(0), earlyNow).length === 1)

// 17. Wochenansicht
const days = weekDays(monday)
check('Woche hat 7 Tage, beginnt am Montag', days.length === 7 && days[0].getDay() === 1 && days[6].getDay() === 0)
check('Jeder Wochentag beginnt um Mitternacht', days.every((d) => d.getHours() === 0 && d.getMinutes() === 0))

const week = summarizeWeek(events, monday)
check('Woche: Mittwoch hat 2 überschneidende Termine', week[2].overlapIds.size === 2)
check('Woche: andere Tage ohne Überschneidung', week.filter((_, i) => i !== 2).every((d) => d.overlapIds.size === 0))
// Di 11 h, Mi 10 h 45, Do 13 h sind über 10 h. Mo 7 h 45, Fr 5 h 45, Sa 5 h, So 2 h nicht.
check('Woche: Dienstag, Mittwoch und Donnerstag sind stark belegt', week.map((d) => d.heavy).join() === 'false,true,true,true,false,false,false', week.map((d) => d.busy).join(' / '))

// Heute und Woche zeigen dieselben Termine
let mismatch = 0
week.forEach((d, i) => {
  const today = eventsForDay(events, day(i))
  const same = (a: { id: string }[], b: { id: string }[]) => a.map((e) => e.id).join() === b.map((e) => e.id).join()
  if (!same(d.timed, today.timed) || !same(d.allDay, today.allDay)) mismatch++
})
check('Woche und Heute zeigen dieselben Termine', mismatch === 0, `${mismatch} Abweichungen`)

const wedBlocks = layoutDay(week[2].timed, day(2))
const lecBlocks = wedBlocks.filter((b) => b.event.category === 'study')
check('Überschneidende Termine liegen in verschiedenen Spuren', lecBlocks.length === 2 && lecBlocks[0].lane !== lecBlocks[1].lane && lecBlocks.every((b) => b.lanes === 2))
check('Nicht überschneidende Termine füllen die ganze Höhe', wedBlocks.filter((b) => b.event.category !== 'study').every((b) => b.lanes === 1 && b.lane === 0))
check(
  'Alle Blöcke liegen innerhalb des Rasters',
  week.every((d) => d.blocks.every((b) => b.left >= 0 && b.width > 0 && b.left + b.width <= 1 + 1e-9)),
)
const dueBlock = layoutDay(week[1].timed, day(1)).find((b) => b.event.id === due.id)
check('Termin nach 22 Uhr erscheint als Marker am rechten Rand', !!dueBlock && dueBlock.left + dueBlock.width > 0.99 && dueBlock.width < 0.05)

const totals = categoryMinutes(week)
check('Summe Training 12 h 30', totals.training === 750, `${totals.training} min`)
check('Summe Arbeit 29 h 30', totals.work === 1770, `${totals.work} min`)
check('Summe Studium 7 h', totals.study === 420, `${totals.study} min`)
check('Summe Privat 5 h 30 (Termin ohne Ende zählt nicht)', totals.private === 330, `${totals.private} min`)

// Woche mit Zeitumstellung (19.–25. Oktober 2026)
const dstWeek = weekDays(new Date(2026, 9, 19))
check('Zeitumstellung: 7 Tage, alle um Mitternacht', dstWeek.length === 7 && dstWeek.every((d) => d.getHours() === 0) && dstWeek[6].getDate() === 25)

// Google-Umwandlung
const g1 = mapGoogleEvent({ id: 'a1', summary: 'Lauf: Intervalle', start: { dateTime: '2026-10-14T18:00:00+02:00' }, end: { dateTime: '2026-10-14T19:00:00+02:00' } }, 'primary')
check('Google: Termin mit Uhrzeit', !!g1 && g1.allDay === false && g1.category === 'training' && g1.intensity === 'high' && g1.end!.getTime() - g1.start.getTime() === 3600000)
const g2 = mapGoogleEvent({ id: 'b2', summary: 'Geburtstag', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } }, 'primary')
check('Google: ganztägig = lokale Mitternacht bis Mitternacht', !!g2 && g2.allDay && g2.start.getHours() === 0 && g2.start.getDate() === 16 && g2.end!.getDate() === 17 && g2.category === 'private')
check('Google: abgesagter Termin wird übersprungen', mapGoogleEvent({ id: 'c', status: 'cancelled', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } }, 'primary') === null)
check('Google: abgelehnte Einladung wird übersprungen', mapGoogleEvent({ id: 'd', summary: 'X', attendees: [{ self: true, responseStatus: 'declined' }], start: { date: '2026-10-16' }, end: { date: '2026-10-17' } }, 'primary') === null)
const g3 = mapGoogleEvent({ id: 'a1', summary: 'Lauf', start: { dateTime: '2026-10-14T18:00:00+02:00' }, end: { dateTime: '2026-10-14T19:00:00+02:00' } }, 'other')
check('Google: gleiche Termin-ID in anderem Kalender gibt andere ID', !!g1 && !!g3 && g1.id !== g3.id)
check('Google: Termin ohne Titel bekommt Platzhalter', mapGoogleEvent({ id: 'e', start: { date: '2026-10-16' }, end: { date: '2026-10-17' } }, 'primary')?.title === '(ohne Titel)')
check('Kategorien: Schwimmen/Vorlesung/Meeting/Unbekannt', categorize('Schwimmen Technik') === 'training' && categorize('Vorlesung Statistik') === 'study' && categorize('Team Meeting') === 'work' && categorize('Kino') === 'private')

// Intervals.icu-Umwandlung
const i1 = mapIntervalsEvent({ id: 101, name: 'Intervalle 6x800', category: 'WORKOUT', type: 'Run', start_date_local: '2026-10-14T18:00:00', moving_time: 3600 })
check('Intervals: Training mit Uhrzeit und Dauer', !!i1 && !i1.allDay && i1.category === 'training' && i1.start.getHours() === 18 && i1.end!.getTime() - i1.start.getTime() === 3600000 && i1.intensity === 'high' && i1.title.includes('Run'))
const i2 = mapIntervalsEvent({ id: 102, name: 'Lockere Fahrt', category: 'WORKOUT', type: 'Ride', start_date_local: '2026-10-15T00:00:00', moving_time: 5400 })
check('Intervals: Startzeit 00:00 gilt als ganztägig (keine erfundene Belegung)', !!i2 && i2.allDay && i2.start.getHours() === 0 && i2.end!.getDate() === 16)
const i3 = mapIntervalsEvent({ id: 103, name: 'Ironman 70.3', category: 'RACE_A', start_date_local: '2026-10-18' })
check('Intervals: Wettkampf nur mit Datum, lokal und intensiv', !!i3 && i3.allDay && i3.start.getDate() === 18 && i3.intensity === 'high')
check('Intervals: Notizen und Ferien werden übersprungen', mapIntervalsEvent({ id: 1, category: 'NOTE', start_date_local: '2026-10-14T08:00:00' }) === null && mapIntervalsEvent({ id: 2, category: 'HOLIDAY', start_date_local: '2026-10-14' }) === null)
check('Intervals: Eintrag ohne ID wird übersprungen', mapIntervalsEvent({ category: 'WORKOUT', start_date_local: '2026-10-14T08:00:00' }) === null)
const i4 = mapIntervalsEvent({ id: 104, name: 'Schwimmen', category: 'WORKOUT', start_date_local: '2026-10-14T06:30:00' })
check('Intervals: Training ohne Dauer hat unbekanntes Ende', !!i4 && i4.end === null && !i4.allDay)
check('Intervals: ID bleibt bei erneutem Laden gleich', !!i1 && i1.id === mapIntervalsEvent({ id: 101, category: 'WORKOUT', start_date_local: '2026-10-14T18:00:00' })!.id)

const notSet: EventSource = { id: 'intervals', label: 'Intervals.icu', isDemo: false, load: async () => { throw new NotConfigured() } }
const okSrc: EventSource = { id: 'google', label: 'Google', isDemo: false, load: async () => [g1!] }
const skipRes = await loadAllSources([notSet, okSrc], now)
check('Nicht eingerichtete Quelle wird still übersprungen, andere bleiben', skipRes.states.length === 1 && skipRes.states[0].id === 'google' && skipRes.events.length === 1)

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`)
process.exit(failed === 0 ? 0 : 1)
