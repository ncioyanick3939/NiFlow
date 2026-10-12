// Intervals.icu: geplante Trainings (Kalender "events"), nur lesend.
// Endpoint: GET /api/v1/athlete/0/events?oldest=yyyy-MM-dd&newest=yyyy-MM-dd
// Doku: https://forum.intervals.icu/t/api-access-to-intervals-icu/609
// Nicht enthalten: bereits absolvierte Aktivitäten (die liegen unter /activities).
// Felder, die wir verwenden: id, name, category, type, start_date_local, end_date_local, moving_time (Sekunden).

import { makeEventId } from '../domain/types'
import type { CalendarEvent, Intensity } from '../domain/types'
import { guessIntensity } from './categorize'

export interface IntervalsEventItem {
  id?: number | string
  uid?: string
  name?: string
  category?: string
  type?: string | null
  start_date_local?: string
  end_date_local?: string | null
  moving_time?: number | null
}

/** "2026-10-14T06:30:00" oder "2026-10-14" als lokale Zeit (ohne Zeitzonen-Verschiebung). */
function parseLocal(value: string): { date: Date; hasTime: boolean } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const hasClock = m[4] !== undefined
  const h = hasClock ? Number(m[4]) : 0
  const mi = hasClock ? Number(m[5]) : 0
  const date = new Date(y, mo - 1, d, h, mi)
  if (Number.isNaN(date.getTime())) return null
  return { date, hasTime: hasClock && (h !== 0 || mi !== 0) }
}

const RACE = /^RACE/i

/**
 * Wandelt einen Intervals.icu-Eintrag um. null = überspringen.
 * Übernommen werden nur geplante Trainings (WORKOUT) und Wettkämpfe (RACE_*).
 * Notizen, Ferien, Krankheit u. Ä. sind keine Trainingszeit und werden nicht gezeigt.
 * Annahme: Startzeit 00:00 heisst "ohne Uhrzeit geplant" und wird als ganztägig gezeigt,
 * damit keine Belegung erfunden wird.
 */
export function mapIntervalsEvent(item: IntervalsEventItem): CalendarEvent | null {
  const category = (item.category ?? '').toUpperCase()
  const isRace = RACE.test(category)
  if (category !== 'WORKOUT' && !isRace) return null
  if (!item.start_date_local) return null
  const start = parseLocal(item.start_date_local)
  if (!start) return null
  const rawId = item.id ?? item.uid
  if (rawId === undefined || rawId === null || rawId === '') return null

  const name = item.name?.trim() || (isRace ? 'Wettkampf' : 'Training')
  const title = item.type && !name.toLowerCase().includes(item.type.toLowerCase()) ? `${name} (${item.type})` : name

  let allDay = false
  let from = start.date
  let to: Date | null = null
  if (!start.hasTime) {
    allDay = true
    from = new Date(start.date.getFullYear(), start.date.getMonth(), start.date.getDate())
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  } else if (typeof item.moving_time === 'number' && item.moving_time > 0) {
    to = new Date(from.getTime() + item.moving_time * 1000)
  } else if (item.end_date_local) {
    const end = parseLocal(item.end_date_local)
    to = end && end.date.getTime() > from.getTime() ? end.date : null
  }

  const intensity: Intensity | undefined = isRace ? 'high' : guessIntensity(name, 'training')
  return {
    id: makeEventId('intervals', String(rawId)),
    source: 'intervals',
    externalId: String(rawId),
    title,
    start: from,
    end: to,
    allDay,
    category: 'training',
    kind: 'event',
    intensity,
  }
}
