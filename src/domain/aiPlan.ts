// KI-Planer: Was die KI über dich erfährt (kompakter Textauszug) und wie ihre Vorschläge geprüft werden.
// Reine Logik ohne Oberfläche und ohne Netzwerk, damit sie getestet werden kann.
//
// Grundsätze:
// - Die KI bekommt nur Titel, Zeiten, Kategorien und Prüfungsthemen, keine Notizen und keine Beschreibungen.
// - Die KI nennt Aufgaben und Prüfungen mit Kurz-IDs (t1, e2). Unbekannte IDs werden verworfen.
// - Vorschläge werden wie Eingaben aus einem Formular geprüft. Ungültiges wird verworfen, nichts wird still gespeichert.

import { addDays, formatTime, startOfDay } from './dateUtils'
import { emptyInput, parseDateInput, toDateInput, validateEntry } from './entries'
import type { EntryInput } from './entries'
import { daysUntil, emptyExam, PREP_LABEL, validateExam } from './exams'
import type { Exam, ExamInput } from './exams'
import { blocksTime, effectiveEnd, eventsForDay, findFreeSlots } from './schedule'
import { emptyTask, taskToInput, validateTask } from './tasks'
import type { Task, TaskInput } from './tasks'
import { CATEGORY_LABEL } from './types'
import { describeDay, outdoorRating, UNSURE_FROM_DAY } from './weather'
import type { DayWeather } from './weather'
import type { CalendarEvent, Category, Priority } from './types'

/** Wie viele Tage voraus die KI sieht. */
export const AI_HORIZON_DAYS = 14
const MAX_TASKS = 60
const MAX_EVENTS_PER_DAY = 14
const MAX_PROPOSALS = 20
const MAX_APPROACH = 6
const CATEGORIES: Category[] = ['training', 'work', 'study', 'private']
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).replace(/\s+/g, ' ').trim()
const dayLabel = (d: Date) => `${WEEKDAY[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`

export interface AiContext {
  /** Text, der an die KI geht. */
  text: string
  /** Kurz-ID -> echte Aufgaben-ID / Prüfungs-ID. */
  taskIds: Map<string, string>
  examIds: Map<string, string>
}

/** Wetter für die KI: days = Vorhersage (null = nicht verfügbar), placeSet = Ort ist eingestellt. Der Ortsname geht nie an die KI. */
export interface AiWeather {
  days: DayWeather[] | null
  placeSet: boolean
}

export function buildAiContext(input: { events: CalendarEvent[]; tasks: Task[]; exams: Exam[]; now: Date; timeZone: string; weather?: AiWeather }): AiContext {
  const { events, tasks, exams, now, timeZone, weather } = input
  const weatherByDate = new Map((weather?.days ?? []).map((d) => [d.date, d]))
  const today = startOfDay(now)
  const lines: string[] = []
  lines.push(`Jetzt: ${dayLabel(now)} ${toDateInput(now)} ${formatTime(now)} (${timeZone})`)
  lines.push('')

  // Prüfungen
  const taskIds = new Map<string, string>()
  const examIds = new Map<string, string>()
  const shortOfExam = new Map<string, string>()
  const upcomingExams = exams.filter((x) => daysUntil(x, now) >= -1).slice(0, 12)
  upcomingExams.forEach((x, i) => {
    examIds.set(`e${i + 1}`, x.id)
    shortOfExam.set(x.id, `e${i + 1}`)
  })
  lines.push('PRÜFUNGEN')
  if (upcomingExams.length === 0) lines.push('keine')
  for (const x of upcomingExams) {
    const open = tasks.filter((t) => t.examId === x.id && t.status !== 'done')
    const topics = x.topics ? ` | Themen: ${clip(x.topics, 160)}` : ''
    lines.push(
      `[${shortOfExam.get(x.id)}] ${clip(x.title)}${x.subject ? ` (${clip(x.subject, 40)})` : ''} | ${toDateInput(x.start)} ${formatTime(x.start)} | in ${daysUntil(x, now)} Tagen | ${PREP_LABEL[x.prepStatus]} | offene Lernaufgaben: ${open.length}${topics}`,
    )
  }
  lines.push('')

  // Offene Aufgaben
  const open = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, MAX_TASKS)
  lines.push('OFFENE AUFGABEN (ohne Datum = Inbox)')
  if (open.length === 0) lines.push('keine')
  open.forEach((t, i) => {
    const id = `t${i + 1}`
    taskIds.set(id, t.id)
    const due = t.dueDate ? `fällig ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}` : 'ohne Datum'
    const exam = t.examId && shortOfExam.get(t.examId) ? ` | Prüfung ${shortOfExam.get(t.examId)}` : ''
    lines.push(`[${id}] ${clip(t.title)} | ${due} | ${t.priority} | ${t.estimateMinutes ? t.estimateMinutes + ' min' : 'Dauer offen'} | ${CATEGORY_LABEL[t.category]}${exam}`)
  })
  lines.push('')

  // Termine und freie Zeit pro Tag
  if (!weather || !weather.placeSet) lines.push('WETTER: kein Ort eingestellt (die Person kann ihn unter Einstellungen → Wetter wählen)')
  else if (!weather.days) lines.push('WETTER: gerade nicht verfügbar')
  else lines.push(`WETTER: Vorhersage für den eingestellten Ort steht bei den einzelnen Tagen (ab dem ${UNSURE_FROM_DAY + 1}. Tag unsicher)`)
  lines.push('')
  lines.push(`KALENDER UND FREIE ZEIT (nächste ${AI_HORIZON_DAYS} Tage)`)
  for (let i = 0; i < AI_HORIZON_DAYS; i++) {
    const day = addDays(today, i)
    const de = eventsForDay(events, day)
    const timed = de.timed.filter((e) => e.kind !== 'task').slice(0, MAX_EVENTS_PER_DAY)
    const allDay = de.allDay.filter((e) => e.kind !== 'task')
    const free = findFreeSlots(de, day, now)
    lines.push(`${dayLabel(day)}${i === 0 ? ' (heute)' : ''}`)
    const w = weatherByDate.get(toDateInput(day))
    if (w) lines.push(`  Wetter: ${describeDay(w)} | draussen: ${outdoorRating(w)}${i >= UNSURE_FROM_DAY ? ' (unsicher)' : ''}`)
    for (const e of allDay) lines.push(`  ganztägig | ${clip(e.title)} | ${CATEGORY_LABEL[e.category]}`)
    for (const e of timed) {
      const end = e.end ? formatTime(e.end) : '?'
      const extra = e.completed ? ' | erledigt' : e.intensity === 'high' ? ' | intensiv' : ''
      lines.push(`  ${formatTime(e.start)}–${end} | ${clip(e.title)} | ${CATEGORY_LABEL[e.category]}${extra}`)
    }
    const freeText = free
      .map((s) => {
        const study = s.study && (s.study.start.getTime() !== s.start.getTime() || s.study.end.getTime() !== s.end.getTime())
        return `${formatTime(s.start)}–${formatTime(s.end)}${study ? ` (Lernen ${formatTime(s.study!.start)}–${formatTime(s.study!.end)})` : ''}`
      })
      .join(', ')
    lines.push(`  frei: ${freeText || 'nichts'}`)
  }

  return { text: lines.join('\n'), taskIds, examIds }
}

// ---------------------------------------------------------------------------
// Vorschläge der KI

/** Rohform, wie sie die Server-Funktion liefert. Alles ist unsicher und wird geprüft. */
export interface RawProposal {
  kind?: unknown
  title?: unknown
  date?: unknown
  start?: unknown
  end?: unknown
  due_date?: unknown
  due_time?: unknown
  category?: unknown
  priority?: unknown
  estimate_minutes?: unknown
  task?: unknown
  exam?: unknown
  subject?: unknown
  location?: unknown
  format?: unknown
  topics?: unknown
  reason?: unknown
}

/**
 * - exam: neue Prüfung. `key` (n1, n2, ...) ist ihr Name innerhalb dieser Antwort.
 * - event/task mit `examKey`: gehört zu einer Prüfung, die im selben Plan neu angelegt wird. Die echte ID gibt es erst nach dem Speichern.
 */
export type Proposal =
  | { kind: 'exam'; key: string; input: ExamInput; reason: string; warning?: string }
  | { kind: 'event'; input: EntryInput; reason: string; warning?: string; examKey?: string }
  | { kind: 'task'; input: TaskInput; reason: string; examKey?: string }
  | { kind: 'move'; taskId: string; task: Task; input: TaskInput; reason: string }

export interface ParsedProposals {
  proposals: Proposal[]
  /** Anzahl verworfener, ungültiger Vorschläge. */
  dropped: number
}

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const time = (v: unknown): string => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : '')
const date = (v: unknown): string => (typeof v === 'string' && parseDateInput(v.trim()) ? v.trim() : '')
const cat = (v: unknown, fallback: Category): Category => (CATEGORIES.includes(v as Category) ? (v as Category) : fallback)

/** Überschneidung mit einem bestehenden Termin (nur Termine mit Uhrzeit, die Zeit belegen). */
export function findConflict(events: CalendarEvent[], day: string, start: string, end: string): CalendarEvent | null {
  const d = parseDateInput(day)
  if (!d || !start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).getTime()
  const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).getTime()
  for (const ev of eventsForDay(events, d).timed) {
    if (!blocksTime(ev)) continue
    if (ev.start.getTime() < e && effectiveEnd(ev).getTime() > s) return ev
  }
  return null
}

export function parseProposals(raw: unknown, ctx: AiContext, tasks: Task[], events: CalendarEvent[], now: Date, exams: Exam[] = []): ParsedProposals {
  const list = Array.isArray(raw) ? (raw.slice(0, MAX_PROPOSALS) as RawProposal[]) : []
  const today = toDateInput(now)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const proposals: Proposal[] = []
  let dropped = 0
  const seen = new Set<string>()
  const examById = new Map(exams.map((x) => [x.id, x]))

  // Neue Prüfungen zuerst lesen: Termine und Aufgaben dieser Antwort dürfen sich mit "n1", "n2" darauf beziehen.
  // Die Nummer zählt alle add_exam der Antwort in Reihenfolge, auch ungültige.
  const newExams = new Map<string, Extract<Proposal, { kind: 'exam' }>>()
  let examCount = 0
  for (const p of list) {
    if (!p || typeof p !== 'object' || p.kind !== 'add_exam') continue
    const key = `n${++examCount}`
    const parsedExam = parseExam(p, key, today, now, exams)
    if (parsedExam) newExams.set(key, parsedExam)
  }
  let examSeen = 0

  /** Liegt der Termin/die Aufgabe nach der Prüfung, ist der Vorschlag sinnlos. */
  const afterExam = (examKey: string | undefined, existing: Exam | undefined, day: string, startTime?: string): boolean => {
    const x = examKey ? newExams.get(examKey)?.input : existing ? { date: toDateInput(existing.start), startTime: `${String(existing.start.getHours()).padStart(2, '0')}:${String(existing.start.getMinutes()).padStart(2, '0')}` } : null
    if (!x) return false
    if (day > x.date) return true
    return day === x.date && !!startTime && startTime >= x.startTime
  }

  for (const p of list) {
    if (!p || typeof p !== 'object') {
      dropped++
      continue
    }
    const reason = str(p.reason, 240)
    const examRef = typeof p.exam === 'string' ? p.exam.trim().toLowerCase() : ''
    const examId = ctx.examIds.get(examRef) ?? null
    const examKey = newExams.has(examRef) ? examRef : undefined
    const linked = examId ? examById.get(examId) : undefined
    const thisExamKey = p.kind === 'add_exam' ? `n${++examSeen}` : ''
    const key = JSON.stringify([p.kind, p.title, p.date, p.start, p.task, p.due_date])
    if (seen.has(key)) continue
    seen.add(key)

    if (p.kind === 'add_exam') {
      const x = newExams.get(thisExamKey)
      if (x) proposals.push(x)
      else dropped++
    } else if (p.kind === 'add_event') {
      const input: EntryInput = {
        ...emptyInput('event', parseDateInput(date(p.date)) ?? now),
        title: str(p.title),
        category: cat(p.category, 'study'),
        allDay: false,
        date: date(p.date),
        startTime: time(p.start),
        endTime: time(p.end),
        examId,
        priority: null,
        reminderMinutes: null,
      }
      if (!input.endTime || input.date < today || validateEntry(input) || afterExam(examKey, linked, input.date, input.startTime)) {
        dropped++
        continue
      }
      const clash = findConflict(events, input.date, input.startTime, input.endTime)
      proposals.push({ kind: 'event', input, reason, examKey, warning: clash ? `Überschneidet sich mit «${clip(clash.title, 40)}»` : undefined })
    } else if (p.kind === 'add_task') {
      const dueDate = date(p.due_date)
      const input: TaskInput = emptyTask({
        title: str(p.title),
        dueDate: dueDate || null,
        dueTime: dueDate ? time(p.due_time) || null : null,
        priority: PRIORITIES.includes(p.priority as Priority) ? (p.priority as Priority) : 'medium',
        category: cat(p.category, 'study'),
        examId,
        estimateMinutes: typeof p.estimate_minutes === 'number' && p.estimate_minutes > 0 && p.estimate_minutes <= 1440 ? Math.round(p.estimate_minutes) : null,
      })
      if ((dueDate && dueDate < today) || validateTask(input) || (dueDate && afterExam(examKey, linked, dueDate))) {
        dropped++
        continue
      }
      proposals.push({ kind: 'task', input, reason, examKey })
    } else if (p.kind === 'move_task') {
      const realId = typeof p.task === 'string' ? ctx.taskIds.get(p.task) : undefined
      const task = realId ? byId.get(realId) : undefined
      const dueDate = date(p.due_date)
      if (!task || task.status === 'done' || !dueDate || dueDate < today) {
        dropped++
        continue
      }
      const dueTime = time(p.due_time) || null
      if (task.dueDate === dueDate && (task.dueTime ?? null) === dueTime) continue
      const input: TaskInput = { ...taskToInput(task), dueDate, dueTime }
      if (validateTask(input)) {
        dropped++
        continue
      }
      proposals.push({ kind: 'move', taskId: task.id, task, input, reason })
    } else {
      dropped++
    }
  }
  // Neue Prüfungen zuerst, damit die Reihenfolge im Plan der Reihenfolge beim Speichern entspricht.
  proposals.sort((a, b) => Number(b.kind === 'exam') - Number(a.kind === 'exam'))
  return { proposals, dropped }
}

/** Eine neue Prüfung aus dem Vorschlag der KI. Ohne Datum und Startzeit gilt sie als ungültig, es wird nichts geraten. */
function parseExam(p: RawProposal, key: string, today: string, now: Date, exams: Exam[]): Extract<Proposal, { kind: 'exam' }> | null {
  const day = date(p.date)
  const input: ExamInput = {
    ...emptyExam(parseDateInput(day) ?? now),
    title: str(p.title),
    subject: str(p.subject, 120),
    date: day,
    startTime: time(p.start),
    endTime: time(p.end),
    location: str(p.location, 200),
    format: str(p.format, 120),
    topics: str(p.topics, 1500),
    priority: PRIORITIES.includes(p.priority as Priority) ? (p.priority as Priority) : 'high',
    prepStatus: 'not_started',
  }
  if (!day || day < today || validateExam(input)) return null
  const lower = input.title.toLowerCase()
  const twin = exams.find((x) => toDateInput(x.start) === day && (x.title.toLowerCase().includes(lower) || lower.includes(x.title.toLowerCase())))
  return { kind: 'exam', key, input, reason: str(p.reason, 240), warning: twin ? `Gibt es schon: «${clip(twin.title, 40)}» am gleichen Tag` : undefined }
}

/** «Vorgehen» der KI: höchstens ein paar kurze Schritte als Text. */
export function parseApproach(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 220))
    .filter(Boolean)
    .slice(0, MAX_APPROACH)
}

export interface PlanSummary {
  exams: number
  events: number
  tasks: number
  moves: number
  /** Gesamtdauer der Termine in Minuten */
  minutes: number
}

/** Zusammenfassung der Vorschläge für die Bestätigung: «1 Prüfung · 8 Lernblöcke (11 h) · 2 Aufgaben». */
export function summarizePlan(list: Proposal[]): PlanSummary {
  const out: PlanSummary = { exams: 0, events: 0, tasks: 0, moves: 0, minutes: 0 }
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  for (const p of list) {
    if (p.kind === 'exam') out.exams++
    else if (p.kind === 'event') {
      out.events++
      out.minutes += Math.max(0, mins(p.input.endTime) - mins(p.input.startTime))
    } else if (p.kind === 'task') out.tasks++
    else out.moves++
  }
  return out
}

export function describeSummary(s: PlanSummary): string {
  const hours = s.minutes % 60 === 0 ? `${s.minutes / 60} h` : `${(s.minutes / 60).toFixed(1).replace('.', ',')} h`
  const parts: string[] = []
  if (s.exams) parts.push(s.exams === 1 ? '1 Prüfung' : `${s.exams} Prüfungen`)
  if (s.events) parts.push(`${s.events} ${s.events === 1 ? 'Termin' : 'Termine'} (${hours})`)
  if (s.tasks) parts.push(`${s.tasks} ${s.tasks === 1 ? 'Aufgabe' : 'Aufgaben'}`)
  if (s.moves) parts.push(`${s.moves} ${s.moves === 1 ? 'Verschiebung' : 'Verschiebungen'}`)
  return parts.join(' · ')
}

/** Kurzer Text für den Gesprächsverlauf, damit die KI später weiss, was vorgeschlagen wurde. */
export function describeProposal(p: Proposal): string {
  if (p.kind === 'exam') return `Prüfung «${p.input.title}» am ${p.input.date} ${p.input.startTime}${p.input.endTime ? '–' + p.input.endTime : ''}`
  if (p.kind === 'event') return `Termin «${p.input.title}» am ${p.input.date} ${p.input.startTime}–${p.input.endTime}`
  if (p.kind === 'task') return `Aufgabe «${p.input.title}»${p.input.dueDate ? ` bis ${p.input.dueDate}` : ' (Inbox)'}`
  return `Aufgabe «${p.task.title}» verschieben auf ${p.input.dueDate}${p.input.dueTime ? ' ' + p.input.dueTime : ''}`
}

/** Vorschläge für die ersten Fragen, passend zur Lage (nächste Prüfung, überfällige Aufgaben). */
export function quickPrompts(exams: Exam[], tasks: Task[], now: Date): string[] {
  const out: string[] = ['Was soll ich heute zuerst machen?']
  const next = exams.filter((x) => daysUntil(x, now) >= 1).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  if (next && daysUntil(next, now) <= 45) out.push(`Plane meine Lernzeit für «${clip(next.subject || next.title, 36)}»`)
  out.push('Neue Prüfung einplanen mit Vorgehen und Plan')
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < toDateInput(now))
  if (overdue.length > 0) out.push('Verteile meine überfälligen Aufgaben neu')
  out.push('Wie wird das Wetter diese Woche?', 'Plane meine Woche inklusive Wetter')
  return out.slice(0, 6)
}
