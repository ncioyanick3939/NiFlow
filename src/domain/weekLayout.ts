// Logik der Wochenansicht: Wochentage, Anordnung der Termine im Wochenraster,
// Überschneidungen, Belegung und Summen pro Kategorie.
//
// Alles baut auf eventsForDay() aus schedule.ts auf. So zeigen "Heute" und "Woche"
// garantiert dieselben Termine.

import { addDays, atTime, startOfDay } from './dateUtils'
import {
  RULES,
  busyMinutes,
  effectiveEnd,
  eventsForDay,
  findOverlaps,
  isHeavyDay,
} from './schedule'
import type { CalendarEvent, Category } from './types'

/** Zeitfenster des Wochenrasters (06:00 bis 22:00). */
export const GRID = { startHour: RULES.dayStartHour, endHour: RULES.dayEndHour } as const

/** Mindestbreite eines Blocks (Anteil der Rasterbreite), damit kurze Termine sichtbar bleiben. */
const MIN_WIDTH = 0.012

const CATEGORY_ORDER: Category[] = ['training', 'work', 'study', 'private']

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startOfDay(weekStart), i))
}

export interface Block {
  event: CalendarEvent
  /** Position und Breite als Anteil (0 bis 1) der Rasterbreite. */
  left: number
  width: number
  /** Spur bei Überschneidungen (0 = oben) und Anzahl Spuren in dieser Gruppe. */
  lane: number
  lanes: number
}

interface Item {
  event: CalendarEvent
  s: number
  e: number
}

/**
 * Ordnet die Termine eines Tages im Raster an. Überschneidende Termine bekommen
 * übereinanderliegende Spuren, damit man sie sieht. Termine ausserhalb von 06 bis 22 Uhr
 * werden als schmaler Marker am Rand gezeigt.
 */
export function layoutDay(
  timed: CalendarEvent[],
  day: Date,
  startHour: number = GRID.startHour,
  endHour: number = GRID.endHour,
): Block[] {
  const ws = atTime(day, startHour).getTime()
  // endHour 24 = Mitternacht am Folgetag (über den Kalender gerechnet, sicher bei Zeitumstellung)
  const we = endHour >= 24 ? addDays(startOfDay(day), 1).getTime() : atTime(day, endHour).getTime()
  const span = we - ws

  const items: Item[] = timed
    .map((event): Item => {
      const s0 = event.start.getTime()
      const e0 = effectiveEnd(event).getTime()
      if (e0 <= ws) return { event, s: ws, e: ws }
      if (s0 >= we) return { event, s: we, e: we }
      return { event, s: Math.max(s0, ws), e: Math.min(e0, we) }
    })
    .sort((a, b) => a.s - b.s || a.e - b.e)

  const blocks: Block[] = []
  let cluster: { item: Item; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity

  const toBlock = (item: Item, lane: number, lanes: number): Block => {
    const width = Math.max((item.e - item.s) / span, MIN_WIDTH)
    let left = (item.s - ws) / span
    if (left + width > 1) left = 1 - width
    return { event: item.event, left, width, lane, lanes }
  }

  const flush = () => {
    const lanes = Math.max(laneEnds.length, 1)
    for (const c of cluster) blocks.push(toBlock(c.item, c.lane, lanes))
    cluster = []
    laneEnds = []
    clusterEnd = -Infinity
  }

  for (const item of items) {
    if (cluster.length > 0 && item.s >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= item.s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.e)
    } else {
      laneEnds[lane] = item.e
    }
    cluster.push({ item, lane })
    clusterEnd = Math.max(clusterEnd, item.e)
  }
  flush()

  return blocks
}

export interface DaySummary {
  date: Date
  timed: CalendarEvent[]
  allDay: CalendarEvent[]
  blocks: Block[]
  /** IDs der Termine, die sich mit einem anderen überschneiden. */
  overlapIds: Set<string>
  /** Belegte Minuten, Überschneidungen werden nicht doppelt gezählt. */
  busy: number
  heavy: boolean
  /** Kategorien, die an diesem Tag vorkommen. */
  categories: Category[]
}

export function summarizeWeek(events: CalendarEvent[], weekStart: Date): DaySummary[] {
  return weekDays(weekStart).map((date) => {
    const { timed, allDay } = eventsForDay(events, date)
    const busy = busyMinutes(timed, date)
    const present = new Set<Category>([...timed, ...allDay].map((e) => e.category))
    return {
      date,
      timed,
      allDay,
      blocks: layoutDay(timed, date),
      overlapIds: new Set(findOverlaps(timed).keys()),
      busy,
      heavy: isHeavyDay(busy),
      categories: CATEGORY_ORDER.filter((c) => present.has(c)),
    }
  })
}

/** Geplante Minuten pro Kategorie in der Woche. Nur Termine mit bekannter Dauer zählen. */
export function categoryMinutes(summaries: DaySummary[]): Record<Category, number> {
  const totals: Record<Category, number> = { training: 0, work: 0, study: 0, private: 0 }
  for (const day of summaries) {
    const from = startOfDay(day.date).getTime()
    const to = addDays(startOfDay(day.date), 1).getTime()
    for (const e of day.timed) {
      if (!e.end || e.kind === 'task') continue
      const a = Math.max(e.start.getTime(), from)
      const b = Math.min(e.end.getTime(), to)
      if (b > a) totals[e.category] += Math.round((b - a) / 60000)
    }
  }
  return totals
}
