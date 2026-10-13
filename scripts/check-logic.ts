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
import { mapIntervalsActivity, mapIntervalsEvent } from '../src/sources/intervals'
import { NotConfigured } from '../src/sources/intervalsSource'
import { emptyInput, eventToInput, inputToRow, parseDateInput, rowToEvent, validateEntry } from '../src/domain/entries'
import type { EntryRow } from '../src/domain/entries'
import { emptyTask, formatDue, groupTasks, inView, isOverdue, sortTasks, taskToEvent, taskToRow, validateTask } from '../src/domain/tasks'
import type { Task } from '../src/domain/tasks'
import { daysUntil, emptyExam, examToRow, rowToExam, suggestStudyTasks, validateExam } from '../src/domain/exams'
import type { ExamRow } from '../src/domain/exams'
import { occurrenceDays, toRRule } from '../src/domain/recurrence'
import { rowToEvents } from '../src/domain/entries'
import { remindersBetween } from '../src/domain/reminders'
import { normalize, recentNotes, search } from '../src/domain/search'
import { suggestColor, validateLabel } from '../src/domain/labels'
import { moveBy, rangeFrom, resizeBy, shiftDays } from '../src/domain/move'
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
const fri = eventsForDay(events.filter((e) => e.externalId !== 'long-window'), day(4))
check('Freitag: ganztägiger Termin erkannt (plus Notiz)', fri.allDay.filter((e) => e.kind !== 'note').length === 1 && fri.allDay.length === 2)
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

// Eigene Einträge: Prüfung und Umwandlung
const base = emptyInput('event', new Date(2026, 9, 14))
check('Eintrag: leerer Titel wird abgelehnt', validateEntry({ ...base, title: '  ' })?.title !== undefined)
check('Eintrag: Titel mit 201 Zeichen wird abgelehnt', validateEntry({ ...base, title: 'x'.repeat(201) })?.title !== undefined)
check('Eintrag: Ende vor Start wird abgelehnt', validateEntry({ ...base, title: 'A', startTime: '10:00', endTime: '09:00' })?.endTime !== undefined)
check('Eintrag: Ende gleich Start wird abgelehnt', validateEntry({ ...base, title: 'A', startTime: '10:00', endTime: '10:00' })?.endTime !== undefined)
check('Eintrag: 31. Februar ist ungültig', parseDateInput('2026-02-31') === null && validateEntry({ ...base, title: 'A', date: '2026-02-31' })?.date !== undefined)
check('Eintrag: gültiger Termin ohne Endzeit', validateEntry({ ...base, title: 'A', startTime: '10:00', endTime: '' }) === null)
const row = inputToRow({ ...base, title: ' Zahnarzt ', category: 'private', date: '2026-10-14', startTime: '14:30', endTime: '15:15', priority: 'high' })
const ev = rowToEvent({ ...row, id: 'abc' } as EntryRow)
check('Eintrag: Hin- und Rückumwandlung ergibt gleiche Zeiten', ev.title === 'Zahnarzt' && ev.start.getHours() === 14 && ev.start.getMinutes() === 30 && ev.end!.getTime() - ev.start.getTime() === 45 * 60000 && ev.priority === 'high' && ev.id === 'own:abc')
check('Eintrag: Bearbeiten-Formular enthält die gespeicherten Werte', eventToInput(ev).startTime === '14:30' && eventToInput(ev).endTime === '15:15' && eventToInput(ev).date === '2026-10-14')
const noteRow = inputToRow({ ...emptyInput('note', new Date(2026, 9, 14)), title: 'Lernplan', body: 'Kapitel 3', priority: 'high' })
const note = rowToEvent({ ...noteRow, id: 'n1' } as EntryRow)
check('Notiz: ganztägig, ohne Priorität, Art "note"', note.allDay && note.kind === 'note' && noteRow.priority === null && note.end!.getDate() === 15)
check('Notiz: macht den Tag nicht "unsicher" für freie Zeit', findFreeSlots(eventsForDay([note], new Date(2026, 9, 14)), new Date(2026, 9, 14), new Date(2026, 9, 14, 7)).every((s) => !s.uncertain))

// Aufgaben
const tNow = new Date(2026, 9, 13, 15, 0) // Di 13.10.2026 15:00
const mk = (o: Partial<Task>): Task => ({ ...emptyTask(), id: Math.random().toString(36), title: 'T', completedAt: null, createdAt: tNow, ...o }) as Task
const tToday = mk({ dueDate: '2026-10-13' })
const tPastTime = mk({ dueDate: '2026-10-13', dueTime: '09:00' })
const tYesterday = mk({ dueDate: '2026-10-12' })
const tSunday = mk({ dueDate: '2026-10-18' })
const tNextWeek = mk({ dueDate: '2026-10-20', priority: 'urgent' })
const tNoDate = mk({ dueDate: null })
const tDone = mk({ dueDate: '2026-10-12', status: 'done', completedAt: new Date(2026, 9, 12) })
check('Aufgaben: Heute enthält nur heutige offene', inView(tToday, 'today', tNow) && !inView(tYesterday, 'today', tNow) && !inView(tDone, 'today', tNow))
check('Aufgaben: Überfällig = gestern oder heute schon vorbei', isOverdue(tYesterday, tNow) && isOverdue(tPastTime, tNow) && !isOverdue(tToday, tNow) && !isOverdue(tDone, tNow))
check('Aufgaben: Diese Woche = Mo bis So', inView(tSunday, 'week', tNow) && inView(tYesterday, 'week', tNow) && !inView(tNextWeek, 'week', tNow))
check('Aufgaben: Als Nächstes = ab morgen, ohne Undatierte', inView(tNextWeek, 'next', tNow) && !inView(tToday, 'next', tNow) && !inView(tNoDate, 'next', tNow))
check('Aufgaben: Erledigte nur in "Erledigt"', inView(tDone, 'done', tNow) && !inView(tDone, 'all', tNow) && inView(tNoDate, 'all', tNow))
const sortedDue = sortTasks([tNoDate, tNextWeek, tYesterday], 'due')
check('Aufgaben: Sortierung nach Fälligkeit, Undatierte zuletzt', sortedDue[0] === tYesterday && sortedDue[2] === tNoDate)
check('Aufgaben: Sortierung nach Priorität', sortTasks([tYesterday, tNextWeek], 'priority')[0] === tNextWeek)
check('Aufgaben: Uhrzeit ohne Datum ist ungültig', validateTask({ ...emptyTask(), title: 'A', dueTime: '10:00' })?.dueTime !== undefined)
check('Aufgaben: Zeitaufwand 3 min ist ungültig', validateTask({ ...emptyTask(), title: 'A', estimateMinutes: 3 })?.estimateMinutes !== undefined)
check('Aufgaben: Abhaken setzt Erledigt-Zeit, Wiedereröffnen löscht sie', 'completed_at' in taskToRow({ ...emptyTask(), title: 'A', status: 'done' }, 'open') && taskToRow({ ...emptyTask(), title: 'A', status: 'open' }, 'done').completed_at === null && !('completed_at' in taskToRow({ ...emptyTask(), title: 'A' }, 'open')))
const tev = taskToEvent(tToday)!
check('Aufgaben: ohne Uhrzeit ganztägig im Kalender, belegt keine Zeit', tev.allDay && tev.kind === 'task' && findFreeSlots(eventsForDay([tev], new Date(2026, 9, 13)), new Date(2026, 9, 13), new Date(2026, 9, 13, 7)).every((x) => !x.uncertain))
const tev2 = taskToEvent(tPastTime)!
check('Aufgaben: mit Uhrzeit erscheinen, zählen nicht als belegt', !tev2.allDay && busyMinutes(eventsForDay([tev2], new Date(2026, 9, 13)).timed, new Date(2026, 9, 13)) === 0)
check('Aufgaben: ohne Datum nicht im Kalender', taskToEvent(tNoDate) === null)
check('Aufgaben: Fälligkeit lesbar', formatDue(tToday, tNow) === 'Heute' && formatDue(tYesterday, tNow) === 'Gestern' && formatDue(tPastTime, tNow) === 'Heute 09:00')

// Prüfungen
const exIn = { ...emptyExam(new Date(2026, 9, 20)), title: 'Statistik', subject: 'Statistik 1' }
check('Prüfung: gültige Eingabe', validateExam(exIn) === null)
check('Prüfung: Ende vor Start ungültig', validateExam({ ...exIn, startTime: '10:00', endTime: '09:00' })?.endTime !== undefined)
const ex = rowToExam({ ...examToRow(exIn), id: 'x1' } as ExamRow)
check('Prüfung: Umwandlung behält Zeiten', ex.start.getHours() === 8 && ex.end!.getHours() === 10 && ex.start.getDate() === 20)
check('Prüfung: Tage bis zur Prüfung', daysUntil(ex, tNow) === 7)
const sug = suggestStudyTasks(ex, tNow)
check('Lernplan: 5 Vorschläge zwischen morgen und Vortag', sug.length === 5 && sug[0].dueDate >= '2026-10-14' && sug[4].dueDate === '2026-10-19' && sug.every((x, i) => i === 0 || x.dueDate >= sug[i - 1].dueDate))
check('Lernplan: kein Vorschlag am Prüfungstag', suggestStudyTasks(ex, new Date(2026, 9, 20, 7)).length === 0)
const sugShort = suggestStudyTasks(ex, new Date(2026, 9, 19, 9))
check('Lernplan: bei 1 Tag alles heute', sugShort.length === 5 && sugShort.every((x) => x.dueDate === '2026-10-19'))

// Wiederholungen
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const wk = occurrenceDays(new Date(2026, 9, 12, 18), 'weekly', null, [], new Date(2026, 9, 1), new Date(2026, 10, 10))
check('Serie wöchentlich: 12., 19., 26. Okt, 2., 9. Nov', wk.map(ymd).join() === '2026-10-12,2026-10-19,2026-10-26,2026-11-02,2026-11-09')
const wd = occurrenceDays(new Date(2026, 9, 16), 'weekdays', null, [], new Date(2026, 9, 16), new Date(2026, 9, 23))
check('Serie werktags: ohne Samstag/Sonntag', wd.map((d) => d.getDay()).join() === '5,1,2,3,4')
const mo = occurrenceDays(new Date(2026, 0, 31), 'monthly', null, [], new Date(2026, 0, 1), new Date(2026, 5, 1))
check('Serie monatlich am 31.: fällt in kurzen Monaten aus', mo.map(ymd).join() === '2026-01-31,2026-03-31,2026-05-31')
check('Serie mit Ende und Ausnahme', occurrenceDays(new Date(2026, 9, 12), 'daily', new Date(2026, 9, 15), ['2026-10-13'], new Date(2026, 9, 1), new Date(2026, 11, 1)).map(ymd).join() === '2026-10-12,2026-10-14,2026-10-15')
const serRow = { id: 's1', type: 'event', title: 'Schwimmen', body: '', category: 'training', all_day: false, start_at: new Date(2026, 9, 22, 6, 30).toISOString(), end_at: new Date(2026, 9, 22, 7, 30).toISOString(), priority: null, recurrence: 'weekly', recurrence_until: null, exdates: [] } as EntryRow
const ser = rowToEvents(serRow, new Date(2026, 9, 19), new Date(2026, 10, 2))
check('Serie über Zeitumstellung: bleibt 06:30–07:30', ser.length === 2 && ser.every((e) => e.start.getHours() === 6 && e.start.getMinutes() === 30 && e.end!.getHours() === 7) && ser[1].start.getDate() === 29)
check('Serie: Vorkommen haben eigene IDs, gleiche Serie', ser[0].id !== ser[1].id && ser.every((e) => e.ref?.id === 's1' && e.externalId === 's1'))
check('Serie: Bearbeiten nimmt den Serienstart', eventToInput(ser[1]).date === '2026-10-22')
check('RRULE für Google', toRRule('weekdays', '2026-12-20') === 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261220T235959Z' && toRRule('none', null) === null)
check('Serie: Ende vor Start wird abgelehnt', validateEntry({ ...emptyInput('event', new Date(2026, 9, 14)), title: 'A', recurrence: 'weekly', recurrenceUntil: '2026-10-01' })?.recurrenceUntil !== undefined)

// Erinnerungen
const remEv = { ...rowToEvent({ ...inputToRow({ ...emptyInput('event', new Date(2026, 9, 14)), title: 'Zahnarzt', startTime: '14:00', endTime: '15:00', reminderMinutes: 30 }), id: 'r1' } as EntryRow) }
const rem = remindersBetween([remEv], [], new Date(2026, 9, 14, 13, 29), new Date(2026, 9, 14, 13, 31))
check('Erinnerung 30 min vor Termin', rem.length === 1 && rem[0].at.getHours() === 13 && rem[0].at.getMinutes() === 30)
check('Erinnerung erscheint nicht zu früh', remindersBetween([remEv], [], new Date(2026, 9, 14, 13, 0), new Date(2026, 9, 14, 13, 29)).length === 0)
const remTask = mk({ dueDate: '2026-10-14', reminderMinutes: 0 })
check('Aufgabe ohne Uhrzeit: Erinnerung 08:00', remindersBetween([], [remTask], new Date(2026, 9, 14, 7, 59), new Date(2026, 9, 14, 8, 0)).length === 1)
check('Erledigte Aufgabe: keine Erinnerung', remindersBetween([], [{ ...remTask, status: 'done' }], new Date(2026, 9, 14, 7), new Date(2026, 9, 14, 9)).length === 0)

// Absolvierte Aktivitäten
const act = mapIntervalsActivity({ id: 'i123', name: 'Morning Run', type: 'Run', start_date_local: '2026-10-12T06:45:10', moving_time: 2700, distance: 8420, icu_training_load: 54.6 })
check('Aktivität: Zeit, Dauer, Distanz, Belastung', !!act && act.completed === true && act.start.getHours() === 6 && act.plannedMinutes === 45 && Math.abs(act.distanceKm! - 8.42) < 0.001 && act.load === 54.6 && act.id === 'intervals:act:i123')
check('Aktivität ohne Startzeit (z. B. Strava-Sperre) wird übersprungen', mapIntervalsActivity({ id: 'x' }) === null)
check('Aktivität belegt Zeit (zählt für freie Zeit)', busyMinutes([act!], new Date(2026, 9, 12)) === 45)

// Suche
check('Suche: Umlaute und Gross/klein egal', normalize('PRÜFUNG Größe') === 'prufung grosse')
const sNote = rowToEvent({ ...inputToRow({ ...emptyInput('note', new Date(2026, 9, 14)), title: 'Lernnotizen Statistik', body: 'Hypothesentests wiederholen' }), id: 'n9' } as EntryRow)
const sEx = rowToExam({ ...examToRow({ ...emptyExam(new Date(2026, 9, 20)), title: 'Modulprüfung', subject: 'Statistik 1', topics: 'Verteilungen' }), id: 'e9' } as ExamRow)
const sRes = search('statistik', { events: [sNote, ...ser], tasks: [mk({ title: 'Statistik Übung' })], exams: [sEx] }, tNow)
check('Suche findet Notiz, Aufgabe, Prüfung', sRes.notes.length === 1 && sRes.tasks.length === 1 && sRes.exams.length === 1 && sRes.events.length === 0)
check('Suche im Notiztext und mehrere Wörter', search('hypothesen wiederholen', { events: [sNote], tasks: [], exams: [] }, tNow).notes.length === 1 && search('hypothesen mathe', { events: [sNote], tasks: [], exams: [] }, tNow).notes.length === 0)
check('Suche: Serie erscheint nur einmal', search('schwimmen', { events: ser, tasks: [], exams: [] }, new Date(2026, 9, 25)).events.length === 1)
check('Suche: Lernstoff einer Prüfung', search('verteilungen', { events: [], tasks: [], exams: [sEx] }, tNow).exams.length === 1)
check('Leere Suche liefert nichts, letzte Notizen schon', search('  ', { events: [sNote], tasks: [], exams: [] }, tNow).notes.length === 0 && recentNotes([sNote]).length === 1)

// Gruppierung der Aufgaben
const grp = groupTasks(sortTasks([tNoDate, tYesterday, tToday, tSunday, tNextWeek, mk({ dueDate: '2026-10-14' })], 'due'), 'all', 'due', tNow)
check('Gruppen in fester Reihenfolge', grp.map((g) => g.key).join() === 'overdue,today,tomorrow,week,later,none', grp.map((g) => g.key).join())
check('Gruppen: andere Sortierung ohne Gruppen', groupTasks([tToday, tYesterday], 'all', 'priority', tNow).length === 1)
check('Gruppen: leere Liste', groupTasks([], 'all', 'due', tNow).length === 0)

// Verschieben und Länge ändern
const mvS = new Date(2026, 9, 14, 10, 0)
const mvE = new Date(2026, 9, 14, 11, 30)
const mv1 = moveBy(mvS, mvE, 37, 0)
check('Verschieben rastet auf 15 min ein, Dauer bleibt', mv1.start.getHours() === 10 && mv1.start.getMinutes() === 30 && mv1.end!.getTime() - mv1.start.getTime() === 90 * 60000)
const mv2 = moveBy(mvS, mvE, 0, 1)
check('Verschieben auf den nächsten Tag', mv2.start.getDate() === 15 && mv2.start.getHours() === 10)
const mv3 = moveBy(mvS, mvE, 20 * 60, 0)
check('Verschieben bleibt im Tag (Ende spätestens 24:00)', mv3.start.getHours() === 22 && mv3.start.getMinutes() === 30 && mv3.end!.getDate() === 15 && mv3.end!.getHours() === 0)
const mvDst = moveBy(new Date(2026, 9, 24, 9, 0), new Date(2026, 9, 24, 10, 0), 0, 1)
check('Verschieben über die Zeitumstellung behält 09:00', mvDst.start.getDate() === 25 && mvDst.start.getHours() === 9 && mvDst.end!.getHours() === 10)
check('Länge ändern: mindestens 15 min', resizeBy(mvS, mvE, -500).getTime() - mvS.getTime() === 15 * 60000)
check('Länge ändern: rastet ein', resizeBy(mvS, mvE, 22).getMinutes() === 45)
check('Ohne Ende: Ende bleibt unbekannt', moveBy(mvS, null, 60, 0).end === null)
const rg = rangeFrom(mvS, 14 * 60 + 40, 13 * 60 + 5)
check('Aufziehen: Richtung egal, auf 15 min gerundet', rg.start.getHours() === 13 && rg.start.getMinutes() === 0 && rg.end.getHours() === 14 && rg.end.getMinutes() === 45)
const rg2 = rangeFrom(mvS, 23 * 60 + 58, 23 * 60 + 58)
check('Aufziehen am Tagesende: mindestens 15 min, endet um 24:00', rg2.start.getHours() === 23 && rg2.start.getMinutes() === 45 && rg2.end.getDate() === 15 && rg2.end.getHours() === 0)
const sh = shiftDays(new Date(2026, 9, 24, 9, 10), new Date(2026, 9, 24, 10, 5), 1)
check('Monat: anderer Tag, Uhrzeit exakt (auch über die Zeitumstellung)', sh.start.getDate() === 25 && sh.start.getHours() === 9 && sh.start.getMinutes() === 10 && sh.end!.getMinutes() === 5)
check('Monat: über das Monatsende', shiftDays(new Date(2026, 9, 30, 8, 0), null, 3).start.getMonth() === 10)
const L = [{ id: 'a', name: 'Statistik', color: 'teal' as const, category: 'study' as const, sort: 0 }]
check('Kategorie: Name doppelt (Gross/Klein egal)', validateLabel(' statistik ', L) !== null)
check('Kategorie: eigener Name beim Bearbeiten erlaubt', validateLabel('Statistik', L, 'a') === null)
check('Kategorie: leer und zu lang abgelehnt', validateLabel('  ', L) !== null && validateLabel('x'.repeat(41), L) !== null)
check('Kategorie: Farbvorschlag ist noch frei', suggestColor(L) !== 'teal')

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`)
process.exit(failed === 0 ? 0 : 1)
