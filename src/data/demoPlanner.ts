// DEMO: erfundene Aufgaben und Prüfungen, nur für den Demo-Modus ohne Anmeldung.
import { addDays, startOfDay } from '../domain/dateUtils'
import { toDateInput } from '../domain/entries'
import type { Exam } from '../domain/exams'
import type { Task } from '../domain/tasks'

export function createDemoPlanner(now: Date): { tasks: Task[]; exams: Exam[] } {
  const d = (n: number) => toDateInput(addDays(startOfDay(now), n))
  const at = (n: number, h: number) => {
    const x = addDays(startOfDay(now), n)
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), h)
  }
  const exams: Exam[] = [
    { id: 'demo-ex1', title: 'Statistik', subject: 'Statistik 1', start: at(7, 8), end: at(7, 10), location: 'Raum B 204', format: 'Schriftlich, 90 min', description: '', topics: 'Wahrscheinlichkeit\nVerteilungen\nHypothesentests', notes: '', priority: 'high', prepStatus: 'in_progress' },
    { id: 'demo-ex2', title: 'Datenbanken', subject: 'Datenbanksysteme', start: at(19, 13), end: at(19, 15), location: '', format: 'Schriftlich', description: '', topics: 'SQL, Normalisierung', notes: '', priority: 'medium', prepStatus: 'not_started' },
  ]
  const base = { description: '', dueTime: null, category: 'study' as const, estimateMinutes: null, reminderMinutes: null, completedAt: null, createdAt: now }
  const tasks: Task[] = [
    { ...base, id: 'demo-t1', title: 'Übungsblatt 4 abgeben', dueDate: d(0), dueTime: '23:59', priority: 'urgent', status: 'open', examId: null },
    { ...base, id: 'demo-t2', title: 'Statistik: Zusammenfassung erstellen', dueDate: d(2), priority: 'high', status: 'in_progress', examId: 'demo-ex1', estimateMinutes: 120 },
    { ...base, id: 'demo-t3', title: 'Statistik: Alte Prüfung bearbeiten', dueDate: d(5), priority: 'high', status: 'open', examId: 'demo-ex1', estimateMinutes: 120 },
    { ...base, id: 'demo-t4', title: 'Velo zum Service bringen', dueDate: d(-1), priority: 'medium', status: 'open', examId: null, category: 'private' },
    { ...base, id: 'demo-t5', title: 'Statistik: Themen wiederholen', dueDate: d(-2), priority: 'medium', status: 'done', examId: 'demo-ex1', completedAt: at(-2, 18) },
    { ...base, id: 'demo-t6', title: 'Bewerbung Werkstudentenstelle', dueDate: null, priority: 'low', status: 'open', examId: null, category: 'work' },
  ]
  return { tasks, exams }
}
