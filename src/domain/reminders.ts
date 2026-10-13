// Erinnerungen: Welche Erinnerungen sind zwischen zwei Zeitpunkten fällig?
// Reine Logik. Angezeigt werden sie von der Oberfläche (Browser-Benachrichtigung, solange NiFlow offen ist).

import { formatTime } from './dateUtils'
import { parseDateInput } from './entries'
import { formatDue } from './tasks'
import type { Task } from './tasks'
import type { CalendarEvent } from './types'

export interface Reminder {
  /** Eindeutig pro Erinnerung, damit sie nur einmal erscheint. */
  key: string
  at: Date
  title: string
  body: string
}

/** Bezugszeit einer Aufgabe: Fälligkeit mit Uhrzeit, sonst 08:00 am Fälligkeitstag. */
export function taskReminderBase(t: Task): Date | null {
  if (!t.dueDate) return null
  const d = parseDateInput(t.dueDate)
  if (!d) return null
  if (t.dueTime) {
    const [h, m] = t.dueTime.split(':').map(Number)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0)
}

export function remindersBetween(events: CalendarEvent[], tasks: Task[], since: Date, until: Date): Reminder[] {
  const out: Reminder[] = []
  for (const e of events) {
    if (e.source !== 'own' || e.allDay || e.reminderMinutes === null || e.reminderMinutes === undefined) continue
    const at = new Date(e.start.getTime() - e.reminderMinutes * 60000)
    if (at > since && at <= until) {
      out.push({
        key: `${e.id}|${e.start.getTime()}|${e.reminderMinutes}`,
        at,
        title: e.title,
        body: e.reminderMinutes === 0 ? `Beginnt jetzt (${formatTime(e.start)})` : `Beginnt um ${formatTime(e.start)}`,
      })
    }
  }
  for (const t of tasks) {
    if (t.status === 'done' || t.reminderMinutes === null) continue
    const base = taskReminderBase(t)
    if (!base) continue
    const at = new Date(base.getTime() - t.reminderMinutes * 60000)
    if (at > since && at <= until) {
      out.push({
        key: `task:${t.id}|${t.dueDate}${t.dueTime ?? ''}|${t.reminderMinutes}`,
        at,
        title: t.title,
        body: `Aufgabe fällig: ${formatDue(t, at) ?? ''}`,
      })
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}
