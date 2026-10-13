import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addDays,
  formatCountdown,
  formatDuration,
  formatTime,
  formatWeekday,
  isSameDay,
  minutesBetween,
  startOfDay,
  startOfWeek,
} from '../domain/dateUtils'
import { toDateInput } from '../domain/entries'
import { PREP_LABEL, daysUntil } from '../domain/exams'
import type { Exam } from '../domain/exams'
import { deadlineUrgency, eventsForDay, nextEvent } from '../domain/schedule'
import { PRIORITY_RANK, inView, isOverdue, sortTasks } from '../domain/tasks'
import type { Task } from '../domain/tasks'
import { CATEGORY_LABEL } from '../domain/types'
import type { CalendarEvent } from '../domain/types'
import WeekStrip from './dashboard/WeekStrip'
import type { DashSection } from './hooks'
import Icon, { categoryIcon } from './icons'
import { colorClass, evClass, useLabelsCtx } from './labels'
import TaskRow from './tasks/TaskRow'

interface Props {
  events: CalendarEvent[]
  now: Date
  loading: boolean
  firstName: string | null
  readOnly: boolean
  onOpen: (e: CalendarEvent) => void
  onCreate: (date: Date, time?: Date) => void
  onCreateNote: (date: Date) => void
  onQuickNote: (title: string) => Promise<void>
  onOpenDay: (d: Date) => void
  onGoTraining: () => void
  tasks: Task[]
  exams: Exam[]
  onToggleTask: (t: Task) => void
  onOpenTask: (t: Task) => void
  onOpenExam: (x: Exam) => void
  onGoTasks: () => void
  onGoExams: () => void
  onQuickTask: (title: string) => Promise<void>
  onCreateTask: () => void
  onCreateExam: () => void
  prefs: Record<DashSection, boolean>
  onSearch: () => void
  /** Öffnet den KI-Planer; fehlt im Demo-Modus. */
  onAssistant?: () => void
}

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

function relDay(d: Date, today: Date): string {
  const n = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000)
  if (n === 1) return 'Morgen'
  if (n === -1) return 'Gestern'
  return n > 0 ? `In ${n} Tagen` : `Vor ${-n} Tagen`
}

const DAY_SHORT = ['Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.', 'So.']
const fmtShort = new Intl.DateTimeFormat('de-CH', { weekday: 'short' })
const MIN = 60000

type Item = { type: 'event'; e: CalendarEvent; at: number; end: number } | { type: 'task'; t: Task; at: number; end: number }
type Row = { type: 'item'; item: Item } | { type: 'now' } | { type: 'gap'; from: number; to: number }

function gapText(mins: number, i: number): string {
  if (mins >= 90) return ['Zeit für einen Lernblock oder eine Pause', 'frei, genug für einen Lernblock', 'Luft zum Durchatmen oder Lernen'][i % 3]
  if (mins >= 45) return ['verbleiben, eine Aufgabe passt gut hinein', 'frei, Zeit für etwas Kleines'][i % 2]
  return 'bis zum nächsten Eintrag'
}

/**
 * «Heute» als Tagesplaner nach dem Vorbild von Structured:
 * grosse Überschrift mit Datum, Tagesstreifen mit Symbol-Punkten, weisses Blatt mit Zeitleiste:
 * Schiene in der Mitte, runde Symbole und Kapseln (Länge = Dauer), Hinweise zur freien Zeit.
 * Darunter Aufgaben ohne Uhrzeit und die Inbox. Rechts: Prüfung, Dringendes, Training, Notizen.
 */
export default function Dashboard(p: Props) {
  const { events, now } = p
  const today = startOfDay(now)
  const [picked, setPicked] = useState<Date | null>(null)
  const touchX = useRef<number | null>(null)
  const day = picked ?? today
  const isToday = isSameDay(day, now)
  const dayKey = toDateInput(day)
  const { byId: labelById } = useLabelsCtx()

  const all = eventsForDay(events, day)
  const timed = all.timed.filter((e) => e.kind !== 'task')
  const allDay = all.allDay.filter((e) => e.kind !== 'task' && e.kind !== 'note')
  const notes = all.allDay.filter((e) => e.kind === 'note')
  const next = nextEvent(events, now)

  const dayTasks = p.tasks.filter((t) => t.dueDate === dayKey)
  const timedTasks = dayTasks.filter((t) => t.dueTime)
  const looseTasks = sortTasks(dayTasks.filter((t) => !t.dueTime), 'priority')
  const doneCount = dayTasks.filter((t) => t.status === 'done').length
  const overdue = isToday ? sortTasks(p.tasks.filter((t) => isOverdue(t, now)), 'due') : []
  const inbox = sortTasks(p.tasks.filter((t) => !t.dueDate && t.status !== 'done'), 'priority')
  const urgentDeadlines = events.filter((e) => deadlineUrgency(e, now) !== null).sort((a, b) => a.start.getTime() - b.start.getTime())
  const soonImportant = sortTasks(p.tasks.filter((t) => t.status !== 'done' && PRIORITY_RANK[t.priority] <= 1 && inView(t, 'next', now)), 'due').slice(0, 3)
  const upcomingExams = p.exams.filter((x) => daysUntil(x, now) >= 0).sort((a, b) => a.start.getTime() - b.start.getTime())
  const exam = upcomingExams[0]
  const examById = new Map(p.exams.map((x) => [x.id, x]))
  const training = events.filter((e) => e.source === 'intervals' && !e.completed && e.start >= today).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  const upcoming = Array.from({ length: 5 }, (_, i) => addDays(today, i + 1)).map((d) => {
    const { allDay: ad, timed: tm } = eventsForDay(events, d)
    return { date: d, items: [...ad, ...tm].filter((e) => e.kind !== 'note' && e.kind !== 'task') }
  })

  // Zeitleiste: Termine und Aufgaben mit Uhrzeit, nach Zeit sortiert
  const items: Item[] = [
    ...timed.map((e): Item => ({ type: 'event', e, at: e.start.getTime(), end: (e.end ?? e.start).getTime() })),
    ...timedTasks.map((t): Item => {
      const [h, m] = (t.dueTime ?? '00:00').split(':').map(Number)
      const at = new Date(day)
      at.setHours(h, m, 0, 0)
      return { type: 'task', t, at: at.getTime(), end: at.getTime() }
    }),
  ].sort((a, b) => a.at - b.at)

  const nowMs = now.getTime()
  const running = isToday && items.some((it) => it.at <= nowMs && it.end >= nowMs && it.end > it.at)
  const rows: Row[] = []
  let markerDone = !isToday || running
  const pushMarker = () => {
    if (!markerDone) {
      rows.push({ type: 'now' })
      markerDone = true
    }
  }
  const dayEnd = new Date(day)
  dayEnd.setHours(22, 0, 0, 0)
  if (p.prefs.free && isToday && items.length > 0 && items[0].at - nowMs >= 30 * MIN) {
    pushMarker()
    rows.push({ type: 'gap', from: nowMs, to: items[0].at })
  }
  items.forEach((it, i) => {
    if (it.at > nowMs) pushMarker()
    rows.push({ type: 'item', item: it })
    const nx = items[i + 1]
    if (nx && p.prefs.free) {
      const from = Math.max(it.end, isToday ? nowMs : 0)
      if (nx.at - from >= 30 * MIN) {
        if (isToday && nx.at > nowMs) pushMarker()
        rows.push({ type: 'gap', from, to: nx.at })
      }
    }
  })
  if (items.length > 0) {
    const last = items[items.length - 1]
    const from = Math.max(last.end, isToday ? nowMs : 0)
    if (isToday && last.end <= nowMs) pushMarker()
    if (p.prefs.free && dayEnd.getTime() - from >= 60 * MIN) rows.push({ type: 'gap', from, to: dayEnd.getTime() })
    pushMarker()
  }
  const nextAt = isToday ? items.find((it) => it.at > nowMs)?.at : undefined

  // Tagesstreifen: sieben Tage mit kleinen Symbol-Punkten pro Kategorie
  const weekStart = startOfWeek(day)
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const ev = eventsForDay(events, d)
    const marks: { key: string; cls: string; icon: ReturnType<typeof categoryIcon> }[] = []
    const seen = new Set<string>()
    for (const e of [...ev.allDay, ...ev.timed]) {
      if (e.kind === 'note' || e.kind === 'task' || seen.has(e.category)) continue
      seen.add(e.category)
      marks.push({ key: e.category, cls: `cat-${e.category}`, icon: categoryIcon(e.category, e.sport) })
    }
    const k = toDateInput(d)
    if (p.tasks.some((t) => t.dueDate === k && t.status !== 'done')) marks.push({ key: 'task', cls: 'col-slate', icon: 'tasks' })
    return { date: d, marks: marks.slice(0, 3) }
  })

  const remaining = timed.filter((e) => (e.end ?? e.start) >= now).length
  const showAside = p.prefs.exams || overdue.length + urgentDeadlines.length + soonImportant.length > 0 || notes.length > 0 || (p.prefs.training && !!training)
  const month = day.toLocaleDateString('de-CH', { month: 'long' })
  const lastIdx = rows.length - 1

  return (
    <div className="mx-auto w-full max-w-[1240px] pb-36 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      {/* Kopf: grosses Datum, Tagesstreifen */}
      <header className="sticky top-[env(safe-area-inset-top)] z-20 bg-canvas px-5 pb-2 pt-4 md:static md:bg-transparent md:px-0 md:pb-0 md:pt-0">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">
              {isToday ? `${greeting(now)}${p.firstName ? `, ${p.firstName}` : ''}` : relDay(day, today)}
              <span className="capitalize"> · {formatWeekday(day)}</span>
            </p>
            <h1 className="h-display mt-0.5 text-[32px] leading-[1.05] md:text-[46px]">
              <button type="button" onClick={() => p.onOpenDay(day)} className="group inline-flex items-center gap-1 text-left" aria-label="Im Kalender öffnen">
                <span>
                  {day.getDate()}. {month}
                </span>
                <span className="text-accent">{day.getFullYear()}</span>
                <Icon name="chevronRight" size={26} className="text-accent transition-transform group-hover:translate-x-0.5" />
              </button>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pb-1">
            {p.onAssistant && (
              <button type="button" onClick={p.onAssistant} className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/[0.14] text-accent transition active:scale-95 md:w-auto md:gap-1.5 md:px-4" aria-label="Planungs-Assistent öffnen">
                <Icon name="sparkle" size={18} />
                <span className="hidden text-sm font-bold md:inline">Assistent</span>
              </button>
            )}
            {!isToday && (
              <button type="button" onClick={() => setPicked(null)} className="h-10 rounded-full bg-accent px-4 text-sm font-bold text-accentink shadow-pop">
                Heute
              </button>
            )}
            <button type="button" onClick={() => setPicked(addDays(day, -7))} className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface text-muted shadow-card hover:text-ink md:flex" aria-label="Vorherige Woche">
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" onClick={() => setPicked(addDays(day, 7))} className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface text-muted shadow-card hover:text-ink md:flex" aria-label="Nächste Woche">
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </div>

        <div
          className="mt-4 grid touch-pan-y grid-cols-7 gap-1"
          onTouchStart={(ev) => {
            touchX.current = ev.touches[0].clientX
          }}
          onTouchEnd={(ev) => {
            const x0 = touchX.current
            touchX.current = null
            if (x0 === null) return
            const dx = ev.changedTouches[0].clientX - x0
            if (Math.abs(dx) > 60) setPicked(addDays(day, dx < 0 ? 7 : -7))
          }}
        >
          {strip.map((sd, i) => {
            const sel = isSameDay(sd.date, day)
            const td = isSameDay(sd.date, now)
            return (
              <button
                key={sd.date.getTime()}
                type="button"
                onClick={() => setPicked(isSameDay(sd.date, today) ? null : sd.date)}
                aria-pressed={sel}
                aria-label={`${fmtShort.format(sd.date)} ${sd.date.getDate()}.`}
                className="flex min-w-0 flex-col items-center gap-1 rounded-2xl py-1 transition-colors hover:bg-surface/70"
              >
                <span className="text-[13px] font-medium text-muted">{DAY_SHORT[i]}</span>
                <span className={`tnum flex h-10 w-10 items-center justify-center rounded-full text-[22px] font-bold leading-none transition-colors ${sel ? 'bg-accent text-accentink shadow-pop' : td ? 'text-accent' : ''}`}>{sd.date.getDate()}</span>
                <span className="flex h-[18px] items-center" aria-hidden="true">
                  {sd.marks.map((m) => (
                    <span key={m.key} className={`${m.cls} -ml-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-cat text-white ring-2 ring-canvas first:ml-0`}>
                      <Icon name={m.icon} size={10} />
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
        </div>

      </header>

      <div className="px-5 md:px-0">
        {isToday && next && (
          <button
            type="button"
            onClick={() => p.onOpen(next)}
            className={`${evClass(next)} mt-3 flex max-w-full items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 text-left text-[13px] shadow-card`}
          >
            <span className="dot-cat h-7 w-7">
              <Icon name={next.kind === 'exam' ? 'exam' : categoryIcon(next.category, next.sport)} size={14} />
            </span>
            <span className="min-w-0 truncate">
              <span className="font-semibold text-muted">Als Nächstes · </span>
              <span className="font-bold">{next.title}</span>
              <span className="font-bold text-accent"> · {formatCountdown(now, next.start)}</span>
            </span>
          </button>
        )}
      </div>

      <div className={`mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-6 md:mt-6 ${showAside ? 'lg:grid-cols-[minmax(0,1fr),23rem]' : ''}`}>
        {/* Weisses Blatt mit der Zeitleiste */}
        <div className="min-w-0 space-y-6">
          <section aria-label="Tagesplan" className="rounded-t-[36px] bg-surface px-3 pb-6 pt-3 shadow-card md:rounded-[32px] md:px-6 md:pb-8 md:pt-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line md:hidden" aria-hidden="true" />

            {allDay.length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-2 px-1">
                {allDay.map((e) => (
                  <li key={e.id} className="min-w-0 max-w-full">
                    <button type="button" onClick={() => p.onOpen(e)} className={`${evClass(e)} flex min-h-11 max-w-full items-center gap-2 rounded-full bg-cat/[0.14] py-1.5 pl-1.5 pr-4 text-left text-sm font-bold`}>
                      <span className="dot-cat h-8 w-8">
                        <Icon name={categoryIcon(e.category, e.sport)} size={15} />
                      </span>
                      <span className="truncate">{e.title}</span>
                      <span className="shrink-0 text-xs font-semibold text-muted">ganztägig</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {items.length === 0 && !p.loading ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sun/25 text-[rgb(var(--warn))]">
                  <Icon name="sun" size={28} />
                </span>
                <p className="h-section">{isToday ? 'Heute ist noch alles frei' : 'An diesem Tag ist noch nichts geplant'}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">Plane einen Lernblock, ein Training oder eine Aufgabe, damit der Tag Form bekommt.</p>
                {!p.readOnly && (
                  <button type="button" className="btn-primary mt-4" onClick={() => p.onCreate(day)}>
                    <Icon name="plus" size={16} /> Eintrag planen
                  </button>
                )}
              </div>
            ) : (
              <ol>
                {rows.map((r, idx) => {
                  const first = idx === 0
                  const last = idx === lastIdx
                  const lineBase = 'pointer-events-none absolute left-[5.2rem] w-0'
                  if (r.type === 'now')
                    return (
                      <li key={`now-${idx}`} className="relative flex h-8 items-center gap-3" aria-label={`Jetzt, ${formatTime(now)}`}>
                        <span className={`${lineBase} border-l-2 border-line ${first ? 'top-4' : 'top-0'} ${last ? 'h-4' : 'bottom-0'}`} aria-hidden="true" />
                        <span className="tnum w-11 shrink-0 text-[13px] font-extrabold">{formatTime(now)}</span>
                        <span className="flex w-14 shrink-0 justify-center" aria-hidden="true">
                          <span className="anim-pulse relative h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
                        </span>
                        <span className="text-[13px] font-bold text-accent">Jetzt</span>
                      </li>
                    )
                  if (r.type === 'gap') {
                    const mins = Math.round((r.to - r.from) / MIN)
                    const long = mins >= 45
                    return (
                      <li key={`gap-${idx}`} className="relative flex items-start gap-3 py-3">
                        <span className={`${lineBase} border-l-2 border-dashed border-accent/60 ${first ? 'top-3' : 'top-0'} ${last ? 'h-6' : 'bottom-0'}`} aria-hidden="true" />
                        <span className="w-11 shrink-0" />
                        <span className="flex w-14 shrink-0 justify-center" aria-hidden="true" />
                        <span className="min-w-0 flex-1 pr-1">
                          <span className="flex items-start gap-2.5 text-[15px] leading-snug text-muted">
                            <Icon name="clock" size={18} className="mt-0.5 shrink-0" />
                            <span>
                              <span className="font-bold text-accent">{formatDuration(mins)}</span> {gapText(mins, idx)}
                            </span>
                          </span>
                          {long && !p.readOnly && (
                            <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent/10 px-4 text-sm font-bold text-accent hover:bg-accent/20" onClick={() => p.onCreate(day, new Date(r.from))}>
                              <Icon name="plus" size={14} /> Einplanen
                            </button>
                          )}
                        </span>
                      </li>
                    )
                  }
                  const it = r.item
                  const past = isToday && (it.type === 'event' ? it.end < nowMs : it.t.status === 'done')
                  const lineCls = `${lineBase} border-l-2 border-line ${first ? 'top-7' : 'top-0'} ${last ? 'h-7' : 'bottom-0'}`
                  if (it.type === 'task') {
                    const t = it.t
                    const label = t.labelId ? labelById.get(t.labelId) : undefined
                    const done = t.status === 'done'
                    return (
                      <li key={`t-${t.id}`} className={`${colorClass(t.category, label)} relative flex gap-3 pb-4`}>
                        <span className={lineCls} aria-hidden="true" />
                        <span className="tnum w-11 shrink-0 pt-1 text-[13px] text-muted">{t.dueTime}</span>
                        <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface2 text-cat">
                          <Icon name="tasks" size={24} />
                        </span>
                        <div className="flex min-w-0 flex-1 items-start gap-1">
                          <button type="button" onClick={() => p.onOpenTask(t)} className="min-w-0 flex-1 self-start py-0.5 text-left">
                            <span className="block text-[13px] text-muted">
                              Aufgabe{t.estimateMinutes ? ` · ${formatDuration(t.estimateMinutes)}` : ''}
                              {t.priority === 'urgent' ? ' · dringend' : t.priority === 'high' ? ' · wichtig' : ''}
                            </span>
                            <span className={`block text-[19px] font-bold leading-snug tracking-[-0.01em] ${done ? 'text-muted line-through' : ''}`}>{t.title}</span>
                          </button>
                          <Check done={done} disabled={p.readOnly} title={t.title} onToggle={() => p.onToggleTask(t)} />
                        </div>
                      </li>
                    )
                  }
                  const e = it.e
                  const mins = e.end ? minutesBetween(e.start, e.end) : 0
                  const isRunning = isToday && it.at <= nowMs && it.end >= nowMs && it.end > it.at
                  const height = mins >= 45 ? Math.min(56 + (mins - 30) * 0.7, 230) : 56
                  return (
                    <li key={e.id} className={`${evClass(e)} relative flex gap-3 pb-4 ${past ? 'opacity-60' : ''}`}>
                      <span className={lineCls} aria-hidden="true" />
                      <span className="tnum w-11 shrink-0 pt-1 text-[13px] text-muted">{formatTime(e.start)}</span>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={() => p.onOpen(e)}
                        style={{ height }}
                        className={`relative z-10 flex w-14 shrink-0 justify-center rounded-full bg-cat pt-[15px] text-white ${isRunning ? 'ring-4 ring-accent/30' : ''}`}
                      >
                        <Icon name={e.kind === 'exam' ? 'exam' : categoryIcon(e.category, e.sport)} size={24} />
                      </button>
                      <button type="button" onClick={() => p.onOpen(e)} className="min-w-0 flex-1 self-start py-0.5 text-left">
                        <span className="tnum block text-[13px] text-muted">
                          {formatTime(e.start)}
                          {e.end ? `–${formatTime(e.end)}` : ''}
                          {mins > 0 ? ` · ${formatDuration(mins)}` : ''}
                        </span>
                        <span className="block text-[19px] font-bold leading-snug tracking-[-0.01em]">{e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                          <span className="rounded-full bg-cat/[0.16] px-2.5 py-0.5 text-cat">{e.labelName ?? CATEGORY_LABEL[e.category]}</span>
                          {e.kind === 'deadline' && <span className="rounded-full bg-danger/12 px-2.5 py-0.5 text-danger">Frist</span>}
                          {e.completed && <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-muted">absolviert</span>}
                          {isRunning && <span className="rounded-full bg-accent px-2.5 py-0.5 text-accentink">läuft gerade</span>}
                          {nextAt === it.at && !isRunning && <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-accent">{formatCountdown(now, new Date(it.at))}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}

            {/* Aufgaben ohne Uhrzeit */}
            {p.prefs.tasks && (
              <div className="mt-4 border-t border-line px-1 pt-5" aria-labelledby="tasks-h">
                <div className="mb-2 flex items-center gap-3">
                  <h2 id="tasks-h" className="h-section mr-auto">
                    {isToday ? 'Aufgaben für heute' : 'Aufgaben'}
                  </h2>
                  {dayTasks.length > 0 && <Ring done={doneCount} total={dayTasks.length} small />}
                </div>
                {looseTasks.length === 0 ? (
                  <p className="py-2 text-sm text-muted">
                    {dayTasks.length > 0 ? (doneCount === dayTasks.length ? 'Alles erledigt. Stark!' : 'Die übrigen Aufgaben haben eine Uhrzeit und stehen oben im Tagesplan.') : 'Für diesen Tag ist nichts fällig.'}
                  </p>
                ) : (
                  <div>
                    {looseTasks.map((t) => (
                      <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                    ))}
                  </div>
                )}
                {!p.readOnly && p.prefs.quick && <QuickAdd onTask={p.onQuickTask} onNote={p.onQuickNote} />}
              </div>
            )}

            {/* Inbox: Aufgaben ohne Datum */}
            {p.prefs.tasks && inbox.length > 0 && (
              <div className="mt-6 border-t border-line px-1 pt-5" aria-labelledby="inbox-h">
                <div className="mb-1 flex items-center gap-3">
                  <h2 id="inbox-h" className="h-section mr-auto">
                    Inbox
                  </h2>
                  <span className="tnum rounded-full bg-surface2 px-2.5 py-0.5 text-[13px] font-bold text-muted">{inbox.length}</span>
                </div>
                <div>
                  {inbox.slice(0, 4).map((t) => (
                    <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                  ))}
                </div>
                <button type="button" className="mt-1 min-h-11 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent/10" onClick={p.onGoTasks}>
                  {inbox.length > 4 ? `Alle ${inbox.length} Aufgaben` : 'Alle Aufgaben'}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Seitenspalte */}
        {showAside && (
          <aside className="min-w-0 space-y-4 px-4 md:px-0">
            {p.prefs.exams &&
              (exam ? (
                <ExamSpotlight exam={exam} tasks={p.tasks.filter((t) => t.examId === exam.id)} now={now} onOpen={() => p.onOpenExam(exam)} more={upcomingExams.length - 1} onAll={p.onGoExams} />
              ) : (
                <section className="rule">
                  <h2 className="h-section">Keine Prüfung geplant</h2>
                  <p className="mt-1 text-sm text-muted">Trag die nächste Prüfung ein, dann plant NiFlow mit dir die Lernaufgaben.</p>
                  {!p.readOnly && (
                    <button type="button" className="btn-primary mt-3" onClick={p.onCreateExam}>
                      <Icon name="plus" size={15} /> Prüfung anlegen
                    </button>
                  )}
                </section>
              ))}

            {overdue.length + urgentDeadlines.length + soonImportant.length > 0 && (
              <section className="rule">
                <h2 className="h-section mb-1 flex items-center gap-2">
                  {overdue.length + urgentDeadlines.length > 0 ? 'Dringend' : 'Bald wichtig'}
                  {overdue.length + urgentDeadlines.length > 0 && <span className="tnum rounded-full bg-danger px-2 text-xs font-bold leading-5 text-white">{overdue.length + urgentDeadlines.length}</span>}
                </h2>
                <ul>
                  {urgentDeadlines.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => p.onOpen(e)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-surface2/70">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
                          <Icon name="flag" size={18} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{e.title}</span>
                        <span className="tnum shrink-0 text-xs font-bold text-danger">{formatCountdown(now, e.start)}</span>
                      </button>
                    </li>
                  ))}
                  {overdue.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <TaskRow task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                    </li>
                  ))}
                  {overdue.length + urgentDeadlines.length === 0 &&
                    soonImportant.map((t) => (
                      <li key={t.id}>
                        <TaskRow task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {p.prefs.training && training && (
              <button type="button" onClick={p.onGoTraining} className="cat-training group flex w-full items-center gap-4 rounded-3xl bg-cat/[0.14] p-4 text-left transition duration-150 hover:bg-cat/[0.22] md:p-5">
                <span className="dot-cat h-14 w-14">
                  <Icon name={categoryIcon('training', training.sport)} size={26} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-cat">Nächstes Training</span>
                  <span className="block truncate text-[17px] font-bold">{training.title}</span>
                  <span className="tnum block text-[13px] text-muted">
                    {training.start.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' })}, {formatTime(training.start)}
                    {training.plannedMinutes ? ` · ${formatDuration(training.plannedMinutes)}` : ''}
                  </span>
                </span>
              </button>
            )}

            {notes.length > 0 && (
              <section className="col-amber rounded-3xl bg-cat/[0.16] p-4 md:p-5">
                <h2 className="h-section mb-1 flex items-center gap-2">
                  <Icon name="note" size={18} className="text-cat" /> Notizen
                </h2>
                <ul>
                  {notes.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => p.onOpen(n)} className="block min-h-11 w-full rounded-xl px-1 py-2 text-left transition-colors hover:bg-white/30">
                        <span className="block truncate text-[15px] font-bold">{n.title}</span>
                        {n.description && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.description}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>

      {/* Darunter: nächste Tage, Woche */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 px-4 md:mt-8 md:px-0 lg:grid-cols-12">
        {p.prefs.days && (
          <section className={`rule min-w-0 ${p.prefs.plan ? 'lg:col-span-5' : 'lg:col-span-12'}`} aria-labelledby="days-h">
            <h2 id="days-h" className="h-section mb-2">
              Nächste Tage
            </h2>
            <ol>
              {upcoming.map((d) => (
                <li key={d.date.getTime()}>
                  <button type="button" onClick={() => setPicked(d.date)} className="grid w-full grid-cols-[3rem,minmax(0,1fr)] items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-surface2/70">
                    <span className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-surface2 leading-none">
                      <span className="text-[10px] font-bold uppercase text-muted">{fmtShort.format(d.date).replace('.', '')}</span>
                      <span className="tnum mt-0.5 text-[17px] font-bold">{d.date.getDate()}</span>
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      {d.items.length === 0 && <span className="block text-sm text-muted">Frei</span>}
                      {d.items.slice(0, 2).map((e) => (
                        <span key={e.id} className={`${evClass(e)} flex items-center gap-2 text-sm leading-5`}>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cat" aria-hidden="true" />
                          {!e.allDay && <span className="tnum shrink-0 text-muted">{formatTime(e.start)}</span>}
                          <span className={`truncate ${e.kind === 'exam' ? 'font-bold' : 'font-semibold'}`}>{e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}</span>
                        </span>
                      ))}
                      {d.items.length > 2 && <span className="block text-xs font-semibold text-muted">+ {d.items.length - 2} weitere</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {p.prefs.plan && (
          <section className={`rule min-w-0 ${p.prefs.days ? 'lg:col-span-7' : 'lg:col-span-12'}`} aria-labelledby="week-h">
            <h2 id="week-h" className="h-section mb-4">
              Deine Woche
            </h2>
            <WeekStrip events={events} now={now} onPickDay={p.onOpenDay} />
          </section>
        )}
      </div>
      <span className="sr-only">{remaining} Termine offen</span>
    </div>
  )
}

/** Runder Haken: füllt sich in der Farbe des Blocks. */
function Check({ done, onToggle, title, disabled }: { done: boolean; onToggle: () => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={done}
      aria-label={done ? `«${title}» wieder öffnen` : `«${title}» erledigt`}
      className="flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-default"
    >
      <span key={done ? 'd' : 'o'} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-150 ${done ? 'anim-pop border-cat bg-cat text-white' : 'border-cat/60 bg-surface/60 hover:border-cat'}`}>
        {done && <Icon name="check" size={15} />}
      </span>
    </button>
  )
}

/** Fortschrittsring für die Aufgaben des Tages. */
function Ring({ done, total, small }: { done: number; total: number; small?: boolean }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  const px = small ? 44 : 84
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: px, height: px }} role="img" aria-label={`${done} von ${total} Aufgaben erledigt`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth={small ? 9 : 7} className="stroke-surface2" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth={small ? 9 : 7} strokeLinecap="round" className="stroke-accent transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="tnum relative text-[12px] font-bold leading-none">
        {done}/{total}
      </span>
    </div>
  )
}

/** Nächste Prüfung: grosser Countdown, Lernfortschritt. */
function ExamSpotlight({ exam, tasks, now, onOpen, more, onAll }: { exam: Exam; tasks: Task[]; now: Date; onOpen: () => void; more: number; onAll: () => void }) {
  const days = daysUntil(exam, now)
  const done = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length > 0 ? done / tasks.length : exam.prepStatus === 'ready' ? 1 : 0
  return (
    <section className="overflow-hidden rounded-3xl bg-deep p-5 text-deepink shadow-float">
      <p className="flex items-center gap-2 text-[13px] font-bold text-deepmuted">
        <Icon name="exam" size={15} /> Nächste Prüfung
      </p>
      <button type="button" onClick={onOpen} className="group mt-3 block w-full text-left">
        <span className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block truncate text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{exam.title}</span>
            <span className="tnum mt-1 block text-[13px] font-medium text-deepmuted">
              {exam.start.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}, {formatTime(exam.start)}
            </span>
          </span>
          <span className="shrink-0 rounded-2xl bg-sun px-3.5 py-2 text-center text-sunink">
            <span className="tnum block text-[30px] font-extrabold leading-none">{days}</span>
            <span className="block text-[11px] font-bold">{days === 0 ? 'heute' : days === 1 ? 'Tag' : 'Tage'}</span>
          </span>
        </span>
        <span className="mt-4 block h-2.5 overflow-hidden rounded-full bg-deepink/15" aria-hidden="true">
          <span className="anim-grow block h-full rounded-full bg-sun" style={{ width: `${Math.max(progress * 100, 3)}%` }} />
        </span>
        <span className="mt-2 flex justify-between gap-3 text-xs font-semibold text-deepmuted">
          <span>{PREP_LABEL[exam.prepStatus]}</span>
          <span className="tnum">{tasks.length > 0 ? `${done}/${tasks.length} Lernaufgaben` : 'Keine Lernaufgaben'}</span>
        </span>
      </button>
      {more > 0 && (
        <button type="button" onClick={onAll} className="mt-2 min-h-11 rounded-full px-3 text-sm font-bold text-sun hover:bg-white/10">
          {more} weitere Prüfung{more > 1 ? 'en' : ''}
        </button>
      )}
    </section>
  )
}

function QuickAdd({ onTask, onNote }: { onTask: (t: string) => Promise<void>; onNote: (t: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const t = text.trim()
    if (!t) return
    setState('busy')
    try {
      await (asNote ? onNote(t) : onTask(t))
      setText('')
      setState('done')
      setMsg(asNote ? 'Notiz für heute gespeichert.' : 'Aufgabe für heute angelegt.')
    } catch (err) {
      setState('error')
      setMsg(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    }
  }
  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex items-center gap-1 rounded-full bg-surface2 pl-1 pr-1 focus-within:ring-2 focus-within:ring-accent">
        <button
          type="button"
          onClick={() => setAsNote((v) => !v)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-muted shadow-card transition-colors hover:text-ink"
          aria-label={asNote ? 'Als Notiz speichern, umschalten zu Aufgabe' : 'Als Aufgabe speichern, umschalten zu Notiz'}
        >
          <Icon name={asNote ? 'note' : 'tasks'} size={14} /> {asNote ? 'Notiz' : 'Aufgabe'}
        </button>
        <label htmlFor="quick" className="sr-only">
          Für heute festhalten
        </label>
        <input
          id="quick"
          className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-base font-medium outline-none md:text-sm placeholder:text-muted/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={asNote ? 'Notiz für heute …' : 'Neue Aufgabe für heute …'}
          value={text}
          maxLength={200}
          onChange={(e) => {
            setText(e.target.value)
            if (state !== 'busy') setState('idle')
          }}
        />
        <button type="submit" className="btn-primary h-10 min-h-10 w-10 shrink-0 rounded-full px-0" disabled={state === 'busy' || !text.trim()} aria-label="Speichern">
          <Icon name="plus" size={18} />
        </button>
      </div>
      {(state === 'done' || state === 'error') && (
        <p className={`mt-2 px-2 text-xs ${state === 'error' ? 'text-danger' : 'text-muted'}`} role="status">
          {msg}
        </p>
      )}
    </form>
  )
}
