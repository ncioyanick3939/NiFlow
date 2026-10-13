// Aufgaben: Datentyp, Prüfung der Eingaben, Ansichten (Heute, Überfällig …), Sortierung
// und Darstellung im Kalender. Reine Logik, ohne Oberfläche und Datenbank.

import { addDays, startOfDay, startOfWeek } from './dateUtils'
import { parseDateInput, toDateInput } from './entries'
import { makeEventId } from './types'
import type { CalendarEvent, Category, Priority } from './types'

export type TaskStatus = 'open' | 'in_progress' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  /** "yyyy-MM-dd" oder null */
  dueDate: string | null
  /** "HH:MM" oder null */
  dueTime: string | null
  priority: Priority
  status: TaskStatus
  category: Category
  examId: string | null
  estimateMinutes: number | null
  /** Erinnerung in Minuten vor Fälligkeit (ohne Uhrzeit: vor 08:00 am Fälligkeitstag). */
  reminderMinutes: number | null
  completedAt: Date | null
  createdAt: Date
}

export interface TaskRow {
  id: string
  title: string
  description: string
  due_date: string | null
  due_time: string | null
  priority: Priority
  status: TaskStatus
  category: Category
  exam_id: string | null
  estimate_minutes: number | null
  reminder_minutes?: number | null
  completed_at: string | null
  created_at: string
}

export type TaskInput = Omit<Task, 'id' | 'completedAt' | 'createdAt'>
export type TaskErrors = Partial<Record<'title' | 'description' | 'dueDate' | 'dueTime' | 'estimateMinutes', string>>

export const STATUS_LABEL: Record<TaskStatus, string> = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' }
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    dueDate: r.due_date,
    // Postgres liefert "HH:MM:SS"
    dueTime: r.due_time ? r.due_time.slice(0, 5) : null,
    priority: r.priority,
    status: r.status,
    category: r.category,
    examId: r.exam_id,
    estimateMinutes: r.estimate_minutes,
    reminderMinutes: r.reminder_minutes ?? null,
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
    createdAt: new Date(r.created_at),
  }
}

export function taskToRow(t: TaskInput, prevStatus?: TaskStatus) {
  const becameDone = t.status === 'done' && prevStatus !== 'done'
  const reopened = t.status !== 'done' && prevStatus === 'done'
  return {
    title: t.title.trim(),
    description: t.description.trim(),
    due_date: t.dueDate || null,
    due_time: t.dueDate && t.dueTime ? t.dueTime : null,
    priority: t.priority,
    status: t.status,
    category: t.category,
    exam_id: t.examId || null,
    estimate_minutes: t.estimateMinutes,
    reminder_minutes: t.dueDate ? t.reminderMinutes : null,
    ...(becameDone ? { completed_at: new Date().toISOString() } : reopened ? { completed_at: null } : {}),
  }
}

export function validateTask(t: TaskInput): TaskErrors | null {
  const e: TaskErrors = {}
  const title = t.title.trim()
  if (!title) e.title = 'Bitte einen Titel eingeben.'
  else if (title.length > 200) e.title = 'Der Titel ist zu lang (höchstens 200 Zeichen).'
  if (t.description.length > 5000) e.description = 'Die Beschreibung ist zu lang.'
  if (t.dueDate && !parseDateInput(t.dueDate)) e.dueDate = 'Ungültiges Datum.'
  if (t.dueTime) {
    if (!t.dueDate) e.dueTime = 'Eine Uhrzeit braucht ein Datum.'
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime)) e.dueTime = 'Ungültige Uhrzeit.'
  }
  if (t.estimateMinutes !== null && (!Number.isInteger(t.estimateMinutes) || t.estimateMinutes < 5 || t.estimateMinutes > 1440)) {
    e.estimateMinutes = 'Zeitaufwand zwischen 5 Minuten und 24 Stunden.'
  }
  return Object.keys(e).length ? e : null
}

export function emptyTask(defaults: Partial<TaskInput> = {}): TaskInput {
  return {
    title: '',
    description: '',
    dueDate: null,
    dueTime: null,
    priority: 'medium',
    status: 'open',
    category: 'study',
    examId: null,
    estimateMinutes: null,
    reminderMinutes: null,
    ...defaults,
  }
}

export const taskToInput = (t: Task): TaskInput => ({
  title: t.title,
  description: t.description,
  dueDate: t.dueDate,
  dueTime: t.dueTime,
  priority: t.priority,
  status: t.status,
  category: t.category,
  examId: t.examId,
  estimateMinutes: t.estimateMinutes,
  reminderMinutes: t.reminderMinutes,
})

/** Fälligkeit als Zeitpunkt (ohne Uhrzeit: Tagesende), für Vergleiche. */
export function dueAt(t: Task): Date | null {
  if (!t.dueDate) return null
  const d = parseDateInput(t.dueDate)
  if (!d) return null
  if (t.dueTime) {
    const [h, m] = t.dueTime.split(':').map(Number)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59)
}

export type TaskView = 'today' | 'next' | 'week' | 'overdue' | 'all' | 'done'

export const VIEW_LABEL: Record<TaskView, string> = {
  today: 'Heute',
  next: 'Als Nächstes',
  week: 'Diese Woche',
  overdue: 'Überfällig',
  all: 'Alle',
  done: 'Erledigt',
}

/** Überfällig: Fälligkeitstag liegt vor heute (oder Uhrzeit ist heute schon vorbei). */
export function isOverdue(t: Task, now: Date): boolean {
  if (t.status === 'done' || !t.dueDate) return false
  const at = dueAt(t)
  if (!at) return false
  if (t.dueTime) return at < now
  return t.dueDate < toDateInput(now)
}

export function inView(t: Task, view: TaskView, now: Date): boolean {
  if (view === 'done') return t.status === 'done'
  if (t.status === 'done') return false
  const today = toDateInput(now)
  switch (view) {
    case 'today':
      return t.dueDate === today
    case 'overdue':
      return isOverdue(t, now)
    case 'week': {
      const mon = toDateInput(startOfWeek(now))
      const sun = toDateInput(addDays(startOfWeek(now), 6))
      return !!t.dueDate && t.dueDate >= mon && t.dueDate <= sun
    }
    case 'next':
      return !!t.dueDate && t.dueDate > today && t.dueDate <= toDateInput(addDays(startOfDay(now), 14))
    case 'all':
      return true
  }
}

export type TaskSort = 'due' | 'priority' | 'category'

export function sortTasks(list: Task[], sort: TaskSort): Task[] {
  const byDue = (a: Task, b: Task) => {
    const da = dueAt(a)?.getTime() ?? Infinity
    const db = dueAt(b)?.getTime() ?? Infinity
    return da - db
  }
  const byPrio = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  const byDone = (a: Task, b: Task) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)
  return [...list].sort((a, b) => {
    if (a.status === 'done' && b.status === 'done') return byDone(a, b)
    if (sort === 'priority') return byPrio(a, b) || byDue(a, b)
    if (sort === 'category') return a.category.localeCompare(b.category) || byDue(a, b) || byPrio(a, b)
    return byDue(a, b) || byPrio(a, b) || a.createdAt.getTime() - b.createdAt.getTime()
  })
}

/** Aufgaben mit Fälligkeit erscheinen im Kalender (ohne Uhrzeit oben im Tag, mit Uhrzeit als Markierung). */
export function taskToEvent(t: Task): CalendarEvent | null {
  if (!t.dueDate) return null
  const day = parseDateInput(t.dueDate)
  if (!day) return null
  const timed = !!t.dueTime
  const start = timed ? dueAt(t)! : day
  return {
    id: makeEventId('own', `task:${t.id}`),
    source: 'own',
    externalId: t.id,
    title: t.title,
    start,
    end: timed ? null : addDays(day, 1),
    allDay: !timed,
    category: t.category,
    kind: 'task',
    priority: t.priority,
    description: t.description || undefined,
    ref: { type: 'task', id: t.id },
    done: t.status === 'done',
    examId: t.examId,
  }
}

const fmtDue = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })

/** "Heute", "Morgen 14:00", "Gestern", "Mo 19. Okt" */
export function formatDue(t: Task, now: Date): string | null {
  if (!t.dueDate) return null
  const d = parseDateInput(t.dueDate)
  if (!d) return null
  const diff = Math.round((d.getTime() - startOfDay(now).getTime()) / 86400000)
  const day =
    diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : diff === -1 ? 'Gestern' : fmtDue.format(d).replace(/\./g, '')
  return t.dueTime ? `${day} ${t.dueTime}` : day
}

export interface TaskGroup {
  key: string
  label: string
  tasks: Task[]
  tone?: 'danger' | 'muted'
}

/**
 * Gruppiert eine (bereits sortierte) Liste für die Anzeige.
 * Nach Fälligkeit: Überfällig, Heute, Morgen, Diese Woche, Später, Ohne Datum.
 * Erledigt: eine gedämpfte Gruppe. Bei anderer Sortierung: keine Gruppen.
 */
export function groupTasks(list: Task[], view: TaskView, sort: TaskSort, now: Date): TaskGroup[] {
  if (list.length === 0) return []
  if (view === 'done') return [{ key: 'done', label: 'Erledigt', tasks: list, tone: 'muted' }]
  if (sort !== 'due') return [{ key: 'all', label: '', tasks: list }]
  const today = toDateInput(now)
  const tomorrow = toDateInput(addDays(startOfDay(now), 1))
  const sunday = toDateInput(addDays(startOfWeek(now), 6))
  const buckets: TaskGroup[] = [
    { key: 'overdue', label: 'Überfällig', tasks: [], tone: 'danger' },
    { key: 'today', label: 'Heute', tasks: [] },
    { key: 'tomorrow', label: 'Morgen', tasks: [] },
    { key: 'week', label: 'Diese Woche', tasks: [] },
    { key: 'later', label: 'Später', tasks: [] },
    { key: 'none', label: 'Ohne Datum', tasks: [], tone: 'muted' },
  ]
  const at = (k: string) => buckets.find((b) => b.key === k)!.tasks
  for (const t of list) {
    if (!t.dueDate) at('none').push(t)
    else if (isOverdue(t, now)) at('overdue').push(t)
    else if (t.dueDate === today) at('today').push(t)
    else if (t.dueDate === tomorrow) at('tomorrow').push(t)
    else if (t.dueDate <= sunday) at('week').push(t)
    else at('later').push(t)
  }
  return buckets.filter((b) => b.tasks.length > 0)
}
