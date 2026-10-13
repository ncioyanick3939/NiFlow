// DEMO: erfundene Aufgaben und Prüfungen, nur für den Demo-Modus ohne Anmeldung.
import { addDays, startOfDay } from '../domain/dateUtils'
import { toDateInput } from '../domain/entries'
import type { Exam } from '../domain/exams'
import type { Label } from '../domain/labels'
import type { Task } from '../domain/tasks'

/** Zwei Beispiel-Kategorien für den Demo-Modus. */
export const DEMO_LABELS: Label[] = [
  { id: 'demo-lab-stat', name: 'Statistik', color: 'teal', category: 'study', sort: 0 },
  { id: 'demo-lab-fam', name: 'Familie', color: 'orange', category: 'private', sort: 1 },
]

export function createDemoPlanner(now: Date): { tasks: Task[]; exams: Exam[] } {
  const d = (n: number) => toDateInput(addDays(startOfDay(now), n))
  const at = (n: number, h: number) => {
    const x = addDays(startOfDay(now), n)
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), h)
  }
  const exams: Exam[] = [
    { id: 'demo-ex1', title: 'Statistik', subject: 'Statistik 1', start: at(7, 8), end: at(7, 10), location: 'Raum B 204', format: 'Schriftlich, 90 min', description: '', topics: 'Wahrscheinlichkeit\nVerteilungen\nHypothesentests', notes: '', priority: 'high', prepStatus: 'in_progress' },
    { id: 'demo-ex2', title: 'Datenbanken', subject: 'Datenbanksysteme', start: at(19, 13), end: at(19, 15), location: '', format: 'Schriftlich', description: '', topics: 'SQL, Normalisierung', notes: '', priority: 'medium', prepStatus: 'not_started' },
    { id: 'demo-ex3', title: 'Lineare Algebra', subject: 'Mathematik 2', start: at(3, 9), end: at(3, 11), location: 'Aula', format: 'Schriftlich, Formelblatt erlaubt', description: '', topics: 'Matrizen\nEigenwerte', notes: '', priority: 'urgent', prepStatus: 'in_progress' },
    { id: 'demo-ex4', title: 'Software Engineering Präsentation', subject: 'Software Engineering', start: at(33, 10), end: at(33, 11), location: '', format: 'Mündlich, Gruppe', description: '', topics: '', notes: '', priority: 'medium', prepStatus: 'not_started' },
  ]
  const base = { description: '', dueTime: null, category: 'study' as const, estimateMinutes: null, reminderMinutes: null, labelId: null as string | null, completedAt: null, createdAt: now }
  const tasks: Task[] = [
    { ...base, id: 'demo-t1', title: 'Übungsblatt 4 abgeben', dueDate: d(0), dueTime: '23:59', priority: 'urgent', status: 'open', examId: null },
    { ...base, id: 'demo-t2', labelId: 'demo-lab-stat', title: 'Statistik: Zusammenfassung erstellen', dueDate: d(2), priority: 'high', status: 'in_progress', examId: 'demo-ex1', estimateMinutes: 120 },
    { ...base, id: 'demo-t3', labelId: 'demo-lab-stat', title: 'Statistik: Alte Prüfung bearbeiten', dueDate: d(5), priority: 'high', status: 'open', examId: 'demo-ex1', estimateMinutes: 120 },
    { ...base, id: 'demo-t4', title: 'Velo zum Service bringen', dueDate: d(-1), priority: 'medium', status: 'open', examId: null, category: 'private' },
    { ...base, id: 'demo-t5', labelId: 'demo-lab-stat', title: 'Statistik: Themen wiederholen', dueDate: d(-2), priority: 'medium', status: 'done', examId: 'demo-ex1', completedAt: at(-2, 18) },
    { ...base, id: 'demo-t6', title: 'Bewerbung Werkstudentenstelle', dueDate: null, priority: 'low', status: 'open', examId: null, category: 'work' },
    { ...base, id: 'demo-t7', title: 'Mathematik 2: Eigenwerte und Eigenvektoren aus Kapitel 5 nochmals durchrechnen und Lösungen mit dem Musterblatt vergleichen', dueDate: d(1), priority: 'high', status: 'open', examId: 'demo-ex3', estimateMinutes: 90 },
    { ...base, id: 'demo-t8', title: 'Formelblatt Lineare Algebra schreiben', dueDate: d(2), priority: 'urgent', status: 'open', examId: 'demo-ex3', estimateMinutes: 60 },
    { ...base, id: 'demo-t9', title: 'Trainingsplan Winter mit Coach besprechen', dueDate: d(4), priority: 'medium', status: 'open', examId: null, category: 'training' },
    { ...base, id: 'demo-t10', title: 'Steuererklärung Unterlagen sammeln', dueDate: d(9), priority: 'medium', status: 'open', examId: null, category: 'private' },
    { ...base, id: 'demo-t11', title: 'Mails an Dozentin beantworten', dueDate: d(0), priority: 'medium', status: 'done', examId: null, completedAt: at(0, 1) },
  ]
  return { tasks, exams }
}
