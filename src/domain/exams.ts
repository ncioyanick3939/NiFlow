// Prüfungen: Datentyp, Prüfung der Eingaben, Countdown, Darstellung im Kalender
// und ein Vorschlag für Lernaufgaben, den der Nutzer bestätigen muss.

import { addDays, startOfDay } from './dateUtils'
import { parseDateInput, toDateInput } from './entries'
import { makeEventId } from './types'
import type { CalendarEvent, Priority } from './types'

export type PrepStatus = 'not_started' | 'in_progress' | 'ready'

export const PREP_LABEL: Record<PrepStatus, string> = {
  not_started: 'Nicht begonnen',
  in_progress: 'In Vorbereitung',
  ready: 'Vorbereitet',
}

export interface Exam {
  id: string
  title: string
  subject: string
  start: Date
  end: Date | null
  location: string
  format: string
  description: string
  topics: string
  notes: string
  priority: Priority
  prepStatus: PrepStatus
}

export interface ExamRow {
  id: string
  title: string
  subject: string
  start_at: string
  end_at: string | null
  location: string
  format: string
  description: string
  topics: string
  notes: string
  priority: Priority
  prep_status: PrepStatus
}

/** Formularwerte */
export interface ExamInput {
  title: string
  subject: string
  date: string
  startTime: string
  endTime: string
  location: string
  format: string
  description: string
  topics: string
  notes: string
  priority: Priority
  prepStatus: PrepStatus
}

export type ExamErrors = Partial<Record<'title' | 'date' | 'startTime' | 'endTime' | 'text', string>>

export const rowToExam = (r: ExamRow): Exam => ({
  id: r.id,
  title: r.title,
  subject: r.subject ?? '',
  start: new Date(r.start_at),
  end: r.end_at ? new Date(r.end_at) : null,
  location: r.location ?? '',
  format: r.format ?? '',
  description: r.description ?? '',
  topics: r.topics ?? '',
  notes: r.notes ?? '',
  priority: r.priority,
  prepStatus: r.prep_status,
})

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function validateExam(v: ExamInput): ExamErrors | null {
  const e: ExamErrors = {}
  if (!v.title.trim()) e.title = 'Bitte einen Namen eingeben.'
  else if (v.title.trim().length > 200) e.title = 'Der Name ist zu lang.'
  if (!parseDateInput(v.date)) e.date = 'Bitte ein gültiges Datum wählen.'
  if (!TIME.test(v.startTime)) e.startTime = 'Bitte eine Startzeit wählen.'
  if (v.endTime) {
    if (!TIME.test(v.endTime)) e.endTime = 'Ungültige Endzeit.'
    else if (TIME.test(v.startTime) && toMin(v.endTime) <= toMin(v.startTime)) e.endTime = 'Das Ende muss nach dem Start liegen.'
  }
  if ([v.description, v.topics, v.notes].some((t) => t.length > 5000) || v.subject.length > 120 || v.location.length > 200 || v.format.length > 120) {
    e.text = 'Ein Textfeld ist zu lang.'
  }
  return Object.keys(e).length ? e : null
}

export function examToRow(v: ExamInput) {
  const day = parseDateInput(v.date)!
  const at = (t: string) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), toMin(t) / 60 | 0, toMin(t) % 60)
  return {
    title: v.title.trim(),
    subject: v.subject.trim(),
    start_at: at(v.startTime).toISOString(),
    end_at: v.endTime ? at(v.endTime).toISOString() : null,
    location: v.location.trim(),
    format: v.format.trim(),
    description: v.description.trim(),
    topics: v.topics.trim(),
    notes: v.notes.trim(),
    priority: v.priority,
    prep_status: v.prepStatus,
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const examToInput = (x: Exam): ExamInput => ({
  title: x.title,
  subject: x.subject,
  date: toDateInput(x.start),
  startTime: hhmm(x.start),
  endTime: x.end ? hhmm(x.end) : '',
  location: x.location,
  format: x.format,
  description: x.description,
  topics: x.topics,
  notes: x.notes,
  priority: x.priority,
  prepStatus: x.prepStatus,
})

export function emptyExam(date: Date): ExamInput {
  return {
    title: '',
    subject: '',
    date: toDateInput(date),
    startTime: '08:00',
    endTime: '10:00',
    location: '',
    format: '',
    description: '',
    topics: '',
    notes: '',
    priority: 'high',
    prepStatus: 'not_started',
  }
}

/** Ganze Kalendertage bis zur Prüfung (0 = heute, negativ = vorbei). */
export function daysUntil(x: Exam, now: Date): number {
  return Math.round((startOfDay(x.start).getTime() - startOfDay(now).getTime()) / 86400000)
}

export function examToEvent(x: Exam): CalendarEvent {
  return {
    id: makeEventId('own', `exam:${x.id}`),
    source: 'own',
    externalId: x.id,
    title: x.subject && !x.title.toLowerCase().includes(x.subject.toLowerCase()) ? `${x.title} · ${x.subject}` : x.title,
    start: x.start,
    end: x.end,
    allDay: false,
    category: 'study',
    kind: 'exam',
    priority: x.priority,
    description: x.location ? `Ort: ${x.location}` : undefined,
    ref: { type: 'exam', id: x.id },
  }
}

export interface StudySuggestion {
  title: string
  dueDate: string
  estimateMinutes: number
}

const PLAN = [
  { title: 'Themen wiederholen', share: 0.15, minutes: 90 },
  { title: 'Zusammenfassung erstellen', share: 0.35, minutes: 120 },
  { title: 'Übungsaufgaben lösen', share: 0.55, minutes: 120 },
  { title: 'Alte Prüfung bearbeiten', share: 0.75, minutes: 120 },
  { title: 'Letzte Wiederholung', share: 1, minutes: 60 },
]

/**
 * Vorschlag für Lernaufgaben, gleichmässig verteilt zwischen morgen und dem Tag vor der Prüfung.
 * Wird nur angelegt, wenn der Nutzer ihn bestätigt. Bei sehr kurzer Zeit landen mehrere Aufgaben
 * am selben Tag; liegt die Prüfung heute oder in der Vergangenheit, gibt es keinen Vorschlag.
 */
export function suggestStudyTasks(x: Exam, now: Date): StudySuggestion[] {
  const days = daysUntil(x, now)
  if (days < 1) return []
  const first = addDays(startOfDay(now), days === 1 ? 0 : 1)
  const last = addDays(startOfDay(x.start), -1)
  const span = Math.max(Math.round((last.getTime() - first.getTime()) / 86400000), 0)
  const name = x.subject || x.title
  return PLAN.map((p) => ({
    title: `${name}: ${p.title}`,
    dueDate: toDateInput(addDays(first, Math.round(span * p.share))),
    estimateMinutes: p.minutes,
  }))
}
