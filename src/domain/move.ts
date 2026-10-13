// Termine im Zeitraster verschieben oder in der Länge ändern.
// Raster 15 Minuten. Tage werden über den Kalender verschoben (nicht +24 h), damit die
// Uhrzeit auch über die Zeitumstellung gleich bleibt.

import { addDays, startOfDay } from './dateUtils'

export const SNAP_MIN = 15

export const snap = (minutes: number): number => Math.round(minutes / SNAP_MIN) * SNAP_MIN

/** Minuten seit Mitternacht (lokale Zeit). */
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

const at = (day: Date, minutes: number) => {
  const m = Math.max(0, Math.min(minutes, 24 * 60))
  if (m === 24 * 60) return addDays(startOfDay(day), 1)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60)
}

/**
 * Verschieben: um `dMin` Minuten (wird aufs Raster gerundet) und `dDays` Tage.
 * Die Dauer bleibt gleich. Der Start bleibt im selben Tag (00:00 bis 24:00 minus Dauer).
 */
export function moveBy(start: Date, end: Date | null, dMin: number, dDays: number): { start: Date; end: Date | null } {
  const day = addDays(startOfDay(start), dDays)
  const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0
  const maxStart = 24 * 60 - Math.max(duration, SNAP_MIN)
  const s = Math.max(0, Math.min(snap(minutesOfDay(start) + dMin), maxStart))
  const newStart = at(day, s)
  return { start: newStart, end: end ? at(day, s + duration) : null }
}

/** Länge ändern: Ende um `dMin` verschieben, mindestens 15 Minuten, höchstens bis Mitternacht. */
export function resizeBy(start: Date, end: Date, dMin: number): Date {
  const day = startOfDay(start)
  const s = minutesOfDay(start)
  const sameDayEnd = Math.round((end.getTime() - day.getTime()) / 60000)
  const e = Math.max(s + SNAP_MIN, Math.min(snap(sameDayEnd + dMin), 24 * 60))
  return at(day, e)
}
