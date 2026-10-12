// Eigene Einträge (Termine/Aktivitäten und Notizen): Eingabe prüfen und in unser Terminformat umwandeln.
// Reine Logik ohne Oberfläche und ohne Datenbank, damit sie getestet werden kann.

import { addDays } from './dateUtils'
import { makeEventId } from './types'
import type { CalendarEvent, Category, Priority } from './types'

export type EntryType = 'event' | 'note'

/** Was im Formular eingegeben wird. */
export interface EntryInput {
  type: EntryType
  title: string
  body: string
  category: Category
  allDay: boolean
  /** Datum als "yyyy-MM-dd". */
  date: string
  /** "HH:MM", nur bei Terminen mit Uhrzeit. */
  startTime: string
  /** "HH:MM" oder leer (Ende unbekannt). */
  endTime: string
  priority: Priority | null
  /** Lerntermin für diese Prüfung (optional). */
  examId?: string | null
  /** Aus dieser Aufgabe eingeplant (optional). */
  taskId?: string | null
}

/** So steht ein Eintrag in der Datenbank (Tabelle entries). */
export interface EntryRow {
  id: string
  type: EntryType
  title: string
  body: string
  category: Category
  all_day: boolean
  start_at: string
  end_at: string | null
  priority: Priority | null
  exam_id?: string | null
  task_id?: string | null
}

export type EntryErrors = Partial<Record<'title' | 'body' | 'date' | 'startTime' | 'endTime', string>>

export const TITLE_MAX = 200
export const BODY_MAX = 5000

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})$/

export function parseDateInput(value: string): Date | null {
  const m = DATE_RE.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  // Ungültige Tage wie 31.02. rutschen sonst still in den nächsten Monat.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}

function parseTimeInput(value: string): { h: number; m: number } | null {
  const m = TIME_RE.exec(value)
  if (!m) return null
  const [h, mi] = [Number(m[1]), Number(m[2])]
  return h < 24 && mi < 60 ? { h, m: mi } : null
}

export const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const toTimeInput = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** Gibt Fehlermeldungen pro Feld zurück, oder null wenn alles gültig ist. */
export function validateEntry(input: EntryInput): EntryErrors | null {
  const errors: EntryErrors = {}
  const title = input.title.trim()
  if (!title) errors.title = 'Bitte einen Titel eingeben.'
  else if (title.length > TITLE_MAX) errors.title = `Der Titel ist zu lang (höchstens ${TITLE_MAX} Zeichen).`
  if (input.body.length > BODY_MAX) errors.body = `Der Text ist zu lang (höchstens ${BODY_MAX} Zeichen).`
  if (!parseDateInput(input.date)) errors.date = 'Bitte ein gültiges Datum wählen.'

  if (input.type === 'event' && !input.allDay) {
    const start = parseTimeInput(input.startTime)
    if (!start) errors.startTime = 'Bitte eine Startzeit wählen.'
    if (input.endTime) {
      const end = parseTimeInput(input.endTime)
      if (!end) errors.endTime = 'Ungültige Endzeit.'
      else if (start && end.h * 60 + end.m <= start.h * 60 + start.m) {
        errors.endTime = 'Das Ende muss nach dem Start liegen.'
      }
    }
  }
  return Object.keys(errors).length > 0 ? errors : null
}

/** Zeiten für die Datenbank. Setzt voraus, dass validateEntry() null ergeben hat. */
export function inputToRow(input: EntryInput): Omit<EntryRow, 'id'> {
  const day = parseDateInput(input.date)!
  const allDay = input.type === 'note' || input.allDay
  let start: Date
  let end: Date | null
  if (allDay) {
    start = day
    end = addDays(day, 1)
  } else {
    const s = parseTimeInput(input.startTime)!
    start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.h, s.m)
    const e = input.endTime ? parseTimeInput(input.endTime) : null
    end = e ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), e.h, e.m) : null
  }
  return {
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category,
    all_day: allDay,
    start_at: start.toISOString(),
    end_at: end ? end.toISOString() : null,
    priority: input.type === 'event' ? input.priority : null,
    exam_id: input.examId ?? null,
    task_id: input.taskId ?? null,
  }
}

export function rowToEvent(row: EntryRow): CalendarEvent {
  return {
    id: makeEventId('own', row.id),
    source: 'own',
    externalId: row.id,
    title: row.title,
    start: new Date(row.start_at),
    end: row.end_at ? new Date(row.end_at) : null,
    allDay: row.all_day,
    category: row.category,
    kind: row.type === 'note' ? 'note' : 'event',
    description: row.body || undefined,
    priority: row.priority ?? undefined,
    ref: { type: 'entry', id: row.id },
    examId: row.exam_id ?? null,
    taskId: row.task_id ?? null,
  }
}

/** Für das Bearbeiten: Termin zurück in Formularwerte. */
export function eventToInput(e: CalendarEvent): EntryInput {
  return {
    type: e.kind === 'note' ? 'note' : 'event',
    title: e.title,
    body: e.description ?? '',
    category: e.category,
    allDay: e.allDay,
    date: toDateInput(e.start),
    startTime: e.allDay ? '09:00' : toTimeInput(e.start),
    endTime: !e.allDay && e.end ? toTimeInput(e.end) : '',
    priority: e.priority ?? null,
    examId: e.examId ?? null,
    taskId: e.taskId ?? null,
  }
}

export function emptyInput(type: EntryType, date: Date, now?: Date): EntryInput {
  const base = now ?? date
  // Vorschlag: nächste volle Stunde bei "heute", sonst 09:00
  const hour = now && toDateInput(now) === toDateInput(date) ? Math.min(base.getHours() + 1, 22) : 9
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    type,
    title: '',
    body: '',
    category: 'private',
    allDay: type === 'note',
    date: toDateInput(date),
    startTime: `${pad(hour)}:00`,
    endTime: `${pad(Math.min(hour + 1, 23))}:00`,
    priority: null,
  }
}
