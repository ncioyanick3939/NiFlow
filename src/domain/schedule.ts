// Geschäftslogik: Welche Termine liegen an einem Tag, Überschneidungen,
// Tagesbelegung und freie Zeitfenster. Hat keinerlei Abhängigkeit zur Oberfläche.
//
// Wichtig: "Heute" und "Woche" rufen beide eventsForDay() auf. Dadurch kann ein Termin
// nicht in der einen Ansicht erscheinen und in der anderen fehlen.

import { addDays, atTime, isSameDay, minutesBetween, startOfDay } from './dateUtils'
import type { CalendarEvent } from './types'

/** Feste Standardwerte der ersten Version (später in den Einstellungen änderbar). */
export const RULES = {
  /** Mindestlänge eines Fensters, das für einen Lernblock vorgeschlagen wird. */
  minStudyMinutes: 90,
  /** Kürzere Lücken werden nicht als freie Zeit angezeigt. */
  minGapDisplayMinutes: 30,
  /** Nach intensivem Training wird eine Stunde lang nichts vorgeschlagen. */
  recoveryAfterIntenseMinutes: 60,
  /** Nach dieser Uhrzeit werden keine Lernblöcke mehr vorgeschlagen (21:30). */
  noStudyAfterHour: 21,
  noStudyAfterMinute: 30,
  /** Mehr als 10 Stunden Belegung markiert den Tag. */
  heavyDayMinutes: 10 * 60,
  /** Annahme für Termine ohne Ende, nur zur Berechnung der Belegung. */
  unknownEndAssumedMinutes: 60,
  /** Zeitraum, in dem freie Zeit angezeigt wird. */
  dayStartHour: 6,
  dayEndHour: 22,
} as const

/** Ende eines Termins; bei unbekanntem Ende wird eine Annahme getroffen. */
export function effectiveEnd(e: CalendarEvent): Date {
  if (e.end) return e.end
  return new Date(e.start.getTime() + RULES.unknownEndAssumedMinutes * 60000)
}

export interface DayEvents {
  timed: CalendarEvent[]
  allDay: CalendarEvent[]
}

export function eventsForDay(events: CalendarEvent[], day: Date): DayEvents {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const timed: CalendarEvent[] = []
  const allDay: CalendarEvent[] = []

  for (const e of events) {
    if (e.allDay) {
      const end = e.end ?? addDays(startOfDay(e.start), 1)
      if (e.start < dayEnd && end > dayStart) allDay.push(e)
    } else if (e.start < dayEnd && effectiveEnd(e) > dayStart) {
      // Ein Termin ohne Ende erscheint nur an seinem Starttag.
      if (e.end || isSameDay(e.start, dayStart)) timed.push(e)
    }
  }

  const byStart = (a: CalendarEvent, b: CalendarEvent) =>
    a.start.getTime() - b.start.getTime() ||
    effectiveEnd(a).getTime() - effectiveEnd(b).getTime()
  timed.sort(byStart)
  allDay.sort(byStart)
  return { timed, allDay }
}

/** Liefert für jeden überschneidenden Termin die Liste der Termine, mit denen er kollidiert. */
export function findOverlaps(timed: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const result = new Map<string, CalendarEvent[]>()
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (a.start < effectiveEnd(b) && b.start < effectiveEnd(a)) {
        result.set(a.id, [...(result.get(a.id) ?? []), b])
        result.set(b.id, [...(result.get(b.id) ?? []), a])
      }
    }
  }
  return result
}

type Interval = [number, number]

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Interval[] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

/** Belegte Minuten an einem Tag. Überschneidungen werden nicht doppelt gezählt. */
export function busyMinutes(timed: CalendarEvent[], day: Date): number {
  const from = startOfDay(day).getTime()
  const to = addDays(startOfDay(day), 1).getTime()
  const clipped: Interval[] = timed.map((e) => [
    Math.max(e.start.getTime(), from),
    Math.min(effectiveEnd(e).getTime(), to),
  ])
  return Math.round(mergeIntervals(clipped).reduce((sum, [a, b]) => sum + (b - a), 0) / 60000)
}

export const isHeavyDay = (minutes: number): boolean => minutes > RULES.heavyDayMinutes

export interface FreeSlot {
  start: Date
  end: Date
  minutes: number
  /** Teilfenster, das für einen Lernblock geeignet wäre (mind. 90 min), sonst null. */
  study: { start: Date; end: Date } | null
  /** true, wenn am Tag ein ganztägiger Termin liegt: Die Zeit ist dann nicht sicher frei. */
  uncertain: boolean
}

function gaps(busy: Interval[], from: number, to: number): Interval[] {
  const result: Interval[] = []
  let cursor = from
  for (const [a, b] of mergeIntervals(busy)) {
    if (b <= cursor) continue
    if (a >= to) break
    if (a > cursor) result.push([cursor, Math.min(a, to)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) result.push([cursor, to])
  return result
}

export function findFreeSlots(
  day: DayEvents,
  date: Date,
  now: Date,
): FreeSlot[] {
  const windowStart = atTime(date, RULES.dayStartHour).getTime()
  const windowEnd = atTime(date, RULES.dayEndHour).getTime()
  const from = isSameDay(date, now) ? Math.max(windowStart, now.getTime()) : windowStart
  if (from >= windowEnd) return []

  const busy: Interval[] = day.timed.map((e) => [e.start.getTime(), effectiveEnd(e).getTime()])
  const recovery = RULES.recoveryAfterIntenseMinutes * 60000
  const busyForStudy: Interval[] = day.timed.map((e) => {
    const end = effectiveEnd(e).getTime()
    const intense = e.category === 'training' && e.intensity === 'high'
    return [e.start.getTime(), intense ? end + recovery : end]
  })

  const studyLimit = Math.min(
    windowEnd,
    atTime(date, RULES.noStudyAfterHour, RULES.noStudyAfterMinute).getTime(),
  )
  const studyGaps = gaps(busyForStudy, from, studyLimit).filter(
    ([a, b]) => (b - a) / 60000 >= RULES.minStudyMinutes,
  )

  return gaps(busy, from, windowEnd)
    .filter(([a, b]) => (b - a) / 60000 >= RULES.minGapDisplayMinutes)
    .map(([a, b]) => {
      const inside = studyGaps
        .filter(([sa, sb]) => sa >= a && sb <= b)
        .sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0]
      return {
        start: new Date(a),
        end: new Date(b),
        minutes: Math.round((b - a) / 60000),
        study: inside ? { start: new Date(inside[0]), end: new Date(inside[1]) } : null,
        uncertain: day.allDay.some((e) => e.kind !== 'note'),
      }
    })
}

/** Der nächste Termin mit Uhrzeit, der noch nicht begonnen hat (auch an späteren Tagen). */
export function nextEvent(events: CalendarEvent[], now: Date): CalendarEvent | null {
  let best: CalendarEvent | null = null
  for (const e of events) {
    if (e.allDay || e.start <= now) continue
    if (!best || e.start < best.start) best = e
  }
  return best
}

export type Urgency = 'h3' | 'h48' | null

/** Abgaben und Prüfungen werden 48 und 3 Stunden vor dem Termin hervorgehoben. */
export function deadlineUrgency(e: CalendarEvent, now: Date): Urgency {
  if (e.kind === 'event') return null
  const hours = minutesBetween(now, e.start) / 60
  if (hours < 0) return null
  if (hours <= 3) return 'h3'
  if (hours <= 48) return 'h48'
  return null
}
