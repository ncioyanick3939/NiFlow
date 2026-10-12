// Datums-Hilfsfunktionen. Es werden bewusst Kalender-Methoden (Jahr/Monat/Tag) statt
// "+24 Stunden" verwendet, damit Sommerzeit-Wechsel (Ende Oktober) korrekt funktionieren.

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())

export const atTime = (day: Date, hour: number, minute = 0): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)

/** Montag der Woche, in der `d` liegt. */
export const startOfWeek = (d: Date): Date => {
  const offset = (d.getDay() + 6) % 7
  return addDays(startOfDay(d), -offset)
}

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const minutesBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / 60000)

const pad = (n: number) => String(n).padStart(2, '0')

export const formatTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${pad(m)}`
}

export const formatWeekday = (d: Date): string =>
  new Intl.DateTimeFormat('de-CH', { weekday: 'long' }).format(d)

export const formatWeekdayShort = (d: Date): string =>
  new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(d).replace('.', '')

export const formatDateLong = (d: Date): string =>
  new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export const formatDayMonth = (d: Date): string =>
  new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' }).format(d)

/** "in 2 h 15", "in 12 min", "läuft" – für den Countdown. */
export function formatCountdown(from: Date, to: Date): string {
  const min = minutesBetween(from, to)
  if (min <= 0) return 'jetzt'
  if (min < 60) return `in ${min} min`
  if (min < 24 * 60) return `in ${formatDuration(min)}`
  const days = Math.floor(min / (24 * 60))
  return days === 1 ? 'morgen' : `in ${days} Tagen`
}

/** Kalenderwoche (ISO 8601). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
