// Wiederkehrende Termine: Vorkommen in einem Zeitraum berechnen.
// Über Kalendertage gerechnet (nicht +24 h), damit die Uhrzeit auch über die Zeitumstellung gleich bleibt.

import { addDays, startOfDay } from './dateUtils'

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Nie',
  daily: 'Täglich',
  weekdays: 'Werktags (Mo–Fr)',
  weekly: 'Wöchentlich',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Monatlich',
}

const MAX = 1500

/**
 * Liefert die Starttage aller Vorkommen, die im Zeitraum [from, to) beginnen oder hineinragen.
 * - start: erstes Vorkommen (lokale Zeit)
 * - durationDays: wie viele Tage ein Vorkommen dauert (für Termine über Mitternacht), mindestens 0
 * - until: letzter erlaubter Tag (inklusive) oder null
 * - exdates: ausgelassene Tage als "yyyy-MM-dd"
 * Monatlich am 31. fällt in Monaten ohne 31. Tag aus (wie in Google Kalender).
 */
export function occurrenceDays(
  start: Date,
  rule: Recurrence,
  until: Date | null,
  exdates: string[],
  from: Date,
  to: Date,
  durationDays = 0,
): Date[] {
  const first = startOfDay(start)
  if (rule === 'none') return [first]
  const skip = new Set(exdates)
  const last = until ? startOfDay(until) : null
  const out: Date[] = []
  const fromDay = addDays(startOfDay(from), -durationDays)

  for (let i = 0; i < MAX * 3 && out.length < MAX; i++) {
    let d: Date
    if (rule === 'monthly') {
      d = new Date(first.getFullYear(), first.getMonth() + i, first.getDate())
      if (d.getDate() !== first.getDate()) continue
    } else {
      const step = rule === 'weekly' ? 7 : rule === 'biweekly' ? 14 : 1
      d = addDays(first, i * step)
      if (rule === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)) continue
    }
    if (last && d > last) break
    if (d >= to) break
    if (d < fromDay) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (skip.has(key)) continue
    out.push(d)
  }
  return out
}

/** RRULE für Google Kalender (RFC 5545). */
export function toRRule(rule: Recurrence, until: string | null): string | null {
  if (rule === 'none') return null
  const base =
    rule === 'daily'
      ? 'FREQ=DAILY'
      : rule === 'weekdays'
        ? 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
        : rule === 'weekly'
          ? 'FREQ=WEEKLY'
          : rule === 'biweekly'
            ? 'FREQ=WEEKLY;INTERVAL=2'
            : 'FREQ=MONTHLY'
  return until ? `RRULE:${base};UNTIL=${until.replace(/-/g, '')}T235959Z` : `RRULE:${base}`
}
