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

export type StudyPhase = 'learn' | 'summary' | 'practice' | 'mock' | 'review'

export interface StudySuggestion {
  title: string
  dueDate: string
  estimateMinutes: number
  phase: StudyPhase
}

/** Lernstoff aus dem Textfeld: eine Zeile oder ein Komma/Semikolon pro Thema, Aufzählungszeichen weg, ohne Doppelte. */
export function parseTopics(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\n;,]/)) {
    const t = raw.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out.slice(0, 12)
}

const MAX_PER_DAY = 2

/**
 * Lernplan-Vorschlag zwischen morgen und dem Tag vor der Prüfung, in vier Phasen:
 * Erarbeiten (pro Thema, wenn Lernstoff eingetragen ist) → Zusammenfassung → Üben → alte Prüfung → letzte Wiederholung.
 * Je weniger Tage bleiben, desto weniger Schritte. Ist die Prüfung schon «Vorbereitet», bleibt nur die letzte Wiederholung.
 * Höchstens zwei Aufgaben pro Tag (bestehende Lernaufgaben zählen mit), schon vorhandene Titel werden nicht doppelt vorgeschlagen.
 * Wird nur angelegt, wenn die Person bestätigt. Liegt die Prüfung heute oder in der Vergangenheit, gibt es keinen Vorschlag.
 */
export function suggestStudyTasks(x: Exam, now: Date, existing: { title: string; dueDate: string | null; status: string }[] = []): StudySuggestion[] {
  const days = daysUntil(x, now)
  if (days < 1) return []
  const first = addDays(startOfDay(now), days === 1 ? 0 : 1)
  const last = addDays(startOfDay(x.start), -1)
  const slots = Math.max(Math.round((last.getTime() - first.getTime()) / 86400000), 0) + 1
  const name = x.subject || x.title
  const heavy = x.priority === 'urgent' || x.priority === 'high'
  const mins = (m: number) => (heavy && m >= 90 ? Math.round((m * 1.25) / 15) * 15 : m)

  type Step = { title: string; minutes: number; phase: StudyPhase; share: number }
  const steps: Step[] = []
  const review: Step = { title: `${name}: Letzte Wiederholung`, minutes: 60, phase: 'review', share: 1 }

  if (x.prepStatus === 'ready') {
    steps.push(review)
  } else if (slots <= 1) {
    steps.push({ title: `${name}: Stoff durchgehen`, minutes: mins(90), phase: 'summary', share: 0 }, review)
  } else {
    const topics = parseTopics(x.topics)
    const verb = x.prepStatus === 'in_progress' ? 'wiederholen' : 'erarbeiten'
    const learnMinutes = x.prepStatus === 'in_progress' ? 60 : 90
    if (topics.length === 0) {
      steps.push({ title: `${name}: Themen wiederholen`, minutes: mins(90), phase: 'learn', share: 0.15 })
    } else {
      // Höchstens halb so viele Lernschritte wie Tage; zusätzliche Themen werden gebündelt
      const count = Math.min(topics.length, Math.max(1, Math.floor(slots / 2)))
      for (let i = 0; i < count; i++) {
        const chunk = topics.slice(Math.floor((i * topics.length) / count), Math.floor(((i + 1) * topics.length) / count))
        steps.push({
          title: `${name}: ${chunk.join(', ')} ${verb}`.slice(0, 190),
          minutes: mins(learnMinutes + (chunk.length - 1) * 30),
          phase: 'learn',
          share: count === 1 ? 0.1 : (0.4 * i) / (count - 1),
        })
      }
    }
    if (slots >= 3) steps.push({ title: `${name}: Zusammenfassung erstellen`, minutes: mins(120), phase: 'summary', share: 0.5 })
    if (slots >= 4) steps.push({ title: `${name}: Übungsaufgaben lösen`, minutes: mins(120), phase: 'practice', share: 0.65 })
    if (slots >= 5) steps.push({ title: `${name}: Alte Prüfung bearbeiten`, minutes: mins(120), phase: 'mock', share: 0.8 })
    if (slots >= 8) steps.push({ title: `${name}: Schwachstellen nachholen`, minutes: 60, phase: 'practice', share: 0.9 })
    steps.push(review)
  }

  const have = new Set(existing.map((t) => t.title.trim().toLowerCase()))
  const load = new Map<string, number>()
  for (const t of existing) if (t.dueDate && t.status !== 'done') load.set(t.dueDate, (load.get(t.dueDate) ?? 0) + 1)

  const out: StudySuggestion[] = []
  let prev = 0
  for (const st of steps.sort((a, b) => a.share - b.share)) {
    if (have.has(st.title.toLowerCase())) continue
    let day = Math.max(Math.round((slots - 1) * st.share), prev)
    while (day < slots - 1 && (load.get(toDateInput(addDays(first, day))) ?? 0) >= MAX_PER_DAY) day++
    const dueDate = toDateInput(addDays(first, day))
    load.set(dueDate, (load.get(dueDate) ?? 0) + 1)
    prev = day
    out.push({ title: st.title, dueDate, estimateMinutes: st.minutes, phase: st.phase })
  }
  return out
}
