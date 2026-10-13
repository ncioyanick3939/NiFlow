import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  addDays,
  formatCountdown,
  formatDateLong,
  formatDuration,
  formatTime,
  formatWeekday,
  isoWeek,
  startOfDay,
} from '../domain/dateUtils'
import { PREP_LABEL, daysUntil } from '../domain/exams'
import type { Exam } from '../domain/exams'
import { deadlineUrgency, eventsForDay, findFreeSlots, nextEvent } from '../domain/schedule'
import { PRIORITY_RANK, inView, isOverdue, sortTasks } from '../domain/tasks'
import type { Task } from '../domain/tasks'
import { CATEGORY_LABEL } from '../domain/types'
import type { CalendarEvent } from '../domain/types'
import DayRiver from './dashboard/DayRiver'
import WeekStrip from './dashboard/WeekStrip'
import type { DashSection } from './hooks'
import Icon, { sportIcon } from './icons'
import type { IconName } from './icons'
import { catClass, formatEventTime } from './kit'
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
}

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

const fmtShortDay = new Intl.DateTimeFormat('de-CH', { weekday: 'short' })

/**
 * Übersicht mit klarer Rangfolge:
 * 1. Tagesfluss (dunkel, gross): was als Nächstes kommt und wie der Tag aussieht
 * 2. Nächste Prüfung (farbig) und Dringendes (rechts)
 * 3. Aufgaben für heute (breit) und nächste Tage (schmal)
 * 4. Woche und Ergänzendes (unten, kompakt)
 */
export default function Dashboard(p: Props) {
  const { events, now } = p
  const today = startOfDay(now)
  const all = eventsForDay(events, today)
  const timed = all.timed.filter((e) => e.kind !== 'task')
  const allDay = all.allDay.filter((e) => e.kind !== 'task' && e.kind !== 'note')
  const notes = all.allDay.filter((e) => e.kind === 'note')
  const next = nextEvent(events, now)
  const free = findFreeSlots({ timed, allDay: all.allDay.filter((e) => e.kind !== 'task') }, today, now)
  const nextFree = p.prefs.free ? free.find((f) => f.study) ?? free[0] : undefined
  const remaining = timed.filter((e) => (e.end ?? e.start) >= now)

  const overdue = sortTasks(p.tasks.filter((t) => isOverdue(t, now)), 'due')
  const todayTasks = sortTasks(p.tasks.filter((t) => inView(t, 'today', now) && !isOverdue(t, now)), 'priority')
  const doneToday = p.tasks.filter((t) => t.status === 'done' && t.completedAt && startOfDay(t.completedAt).getTime() === today.getTime()).length
  const urgentDeadlines = events.filter((e) => deadlineUrgency(e, now) !== null).sort((a, b) => a.start.getTime() - b.start.getTime())
  const soonImportant = sortTasks(
    p.tasks.filter((t) => t.status !== 'done' && PRIORITY_RANK[t.priority] <= 1 && inView(t, 'next', now)),
    'due',
  ).slice(0, 3)
  const upcomingExams = p.exams.filter((x) => daysUntil(x, now) >= 0).sort((a, b) => a.start.getTime() - b.start.getTime())
  const exam = upcomingExams[0]
  const examById = new Map(p.exams.map((x) => [x.id, x]))
  const days = Array.from({ length: 5 }, (_, i) => addDays(today, i + 1)).map((d) => {
    const { allDay: ad, timed: tm } = eventsForDay(events, d)
    return { date: d, items: [...ad, ...tm].filter((e) => e.kind !== 'note') }
  })
  const training = events.filter((e) => e.source === 'intervals' && !e.completed && e.start >= today).sort((a, b) => a.start.getTime() - b.start.getTime())[0]

  const hasSide = notes.length > 0 || (p.prefs.training && !!training)
  const quickActions: { label: string; icon: IconName; go: () => void }[] = [
    { label: 'Aufgabe', icon: 'tasks', go: p.onCreateTask },
    { label: 'Termin', icon: 'calendar', go: () => p.onCreate(today) },
    { label: 'Notiz', icon: 'note', go: () => p.onCreateNote(today) },
    { label: 'Prüfung', icon: 'exam', go: p.onCreateExam },
  ]

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      {/* Kopf: Begrüssung, Datum, schnelle Aktionen */}
      <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 md:mb-8">
        <div className="mr-auto min-w-0">
          <p className="tnum text-sm text-muted">
            <span className="capitalize">{formatWeekday(now)}</span>, {formatDateLong(now)}, KW {isoWeek(now)}
          </p>
          <h1 className="h-display mt-1 text-[32px] leading-[1.1] md:text-[40px]">
            {greeting(now)}
            {p.firstName ? `, ${p.firstName}` : ''}
          </h1>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {!p.readOnly &&
            quickActions.map((a) => (
              <button key={a.label} type="button" onClick={a.go} className="btn-outline min-h-10 flex-1 px-3.5 sm:flex-none">
                <Icon name={a.icon} size={16} /> {a.label}
              </button>
            ))}
          <button type="button" onClick={p.onSearch} className="btn-outline h-10 min-h-10 w-10 px-0 md:hidden" aria-label="Suchen">
            <Icon name="search" size={17} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* 1. Tagesfluss */}
        <section className="relative overflow-hidden rounded-2xl bg-deep p-6 text-deepink md:p-8 lg:col-span-8" aria-label="Dein Tag">
          <svg className="pointer-events-none absolute -right-10 -top-6 h-48 w-80 text-deepink/[0.05]" viewBox="0 0 320 190" fill="none" stroke="currentColor" strokeWidth="18" aria-hidden="true">
            <path d="M0 60c40 0 50-40 90-40s50 40 90 40 50-40 90-40 40 40 50 40" />
            <path d="M0 130c40 0 50-40 90-40s50 40 90 40 50-40 90-40 40 40 50 40" />
          </svg>
          <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="text-sm text-deepmuted">{next ? 'Als Nächstes' : 'Heute'}</p>
              {next ? (
                <button type="button" onClick={() => p.onOpen(next)} className="mt-1 block max-w-full text-left">
                  <span className="h-display block truncate text-[26px] leading-tight md:text-[30px]">{next.title}</span>
                  <span className="tnum mt-1 flex flex-wrap items-center gap-x-3 text-sm text-deepmuted">
                    <span>{formatEventTime(next, startOfDay(next.start).getTime() !== today.getTime())}</span>
                    <span className={`${catClass(next.category)} inline-flex items-center gap-1.5`}>
                      <span className="h-2 w-2 rounded-full bg-cat" aria-hidden="true" />
                      {CATEGORY_LABEL[next.category]}
                    </span>
                  </span>
                </button>
              ) : (
                <p className="h-display mt-1 text-[26px] leading-tight">{p.loading ? 'Lädt …' : 'Keine weiteren Termine'}</p>
              )}
            </div>
            {next && <p className="h-display tnum text-[34px] leading-none text-sun md:text-[44px]">{formatCountdown(now, next.start)}</p>}
          </div>

          <div className="relative mt-7">
            <DayRiver timed={timed} free={p.prefs.free ? free : []} day={today} now={now} onOpen={p.onOpen} />
          </div>

          <div className="relative mt-5 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {[...allDay, ...remaining].slice(0, 6).map((e) => (
              <button key={e.id} type="button" onClick={() => p.onOpen(e)} className={`${catClass(e.category)} flex min-h-10 items-center gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-deepink/[0.07]`}>
                <span className="h-2 w-2 shrink-0 rounded-full bg-cat" aria-hidden="true" />
                <span className="tnum w-11 shrink-0 text-deepmuted">{e.allDay ? 'Tag' : formatTime(e.start)}</span>
                <span className="truncate">{e.title}</span>
              </button>
            ))}
            {[...allDay, ...remaining].length === 0 && !p.loading && <p className="px-2 text-sm text-deepmuted">Der restliche Tag ist frei.</p>}
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-deepink/10 pt-4 text-sm">
            {nextFree ? (
              <span className="mr-auto text-deepmuted">
                Frei {formatTime(nextFree.start)}–{formatTime(nextFree.end)}
                {nextFree.study ? ', genug für einen Lernblock' : ''}
              </span>
            ) : (
              <span className="mr-auto text-deepmuted">{timed.length} Termine heute</span>
            )}
            {nextFree && !p.readOnly && (
              <button type="button" className="font-semibold text-sun hover:underline" onClick={() => p.onCreate(today, nextFree.study?.start ?? nextFree.start)}>
                Einplanen
              </button>
            )}
            <button type="button" className="font-semibold text-deepink hover:underline" onClick={() => p.onOpenDay(today)}>
              Tag im Kalender
            </button>
          </div>
        </section>

        {/* 2. Rechte Spalte: nächste Prüfung, Dringendes */}
        <div className="flex flex-col gap-5 lg:col-span-4 lg:gap-6">
          {p.prefs.exams &&
            (exam ? (
              <ExamSpotlight exam={exam} tasks={p.tasks.filter((t) => t.examId === exam.id)} now={now} onOpen={() => p.onOpenExam(exam)} more={upcomingExams.length - 1} onAll={p.onGoExams} />
            ) : (
              <section className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-line p-6">
                <p className="h-section">Keine Prüfung geplant</p>
                <p className="text-sm text-muted">Trag deine nächste Prüfung ein, dann plant NiFlow mit dir die Lernaufgaben.</p>
                {!p.readOnly && (
                  <button type="button" className="btn-outline min-h-10" onClick={p.onCreateExam}>
                    <Icon name="plus" size={16} /> Prüfung anlegen
                  </button>
                )}
              </section>
            ))}

          <section className="rounded-2xl bg-surface p-5">
            <h2 className="h-section mb-2 flex items-center gap-2">
              Dringend
              {overdue.length + urgentDeadlines.length > 0 && (
                <span className="tnum rounded-full bg-danger px-2 text-xs font-bold leading-5 text-white">{overdue.length + urgentDeadlines.length}</span>
              )}
            </h2>
            {overdue.length + urgentDeadlines.length + soonImportant.length === 0 ? (
              <p className="text-sm text-muted">Nichts überfällig, keine Frist in den nächsten 48 Stunden.</p>
            ) : (
              <ul className="space-y-1">
                {urgentDeadlines.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => p.onOpen(e)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface2">
                      <Icon name="alert" size={16} className="shrink-0 text-danger" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                      <span className="tnum shrink-0 text-xs font-semibold text-danger">{formatCountdown(now, e.start)}</span>
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
            )}
          </section>
        </div>

        {/* 3. Aufgaben für heute */}
        {p.prefs.tasks && (
          <section className="rounded-2xl bg-surface p-5 md:p-6 lg:col-span-7 lg:self-start">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="h-section mr-auto">Aufgaben für heute</h2>
              <span className="tnum text-sm text-muted">
                {todayTasks.length} offen{doneToday > 0 ? `, ${doneToday} erledigt` : ''}
              </span>
            </div>
            {todayTasks.length + doneToday > 0 && (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(doneToday / (todayTasks.length + doneToday)) * 100}%` }} />
              </div>
            )}
            {todayTasks.length === 0 ? (
              <p className="py-2 text-sm text-muted">{doneToday > 0 ? 'Alles für heute erledigt.' : 'Für heute ist nichts fällig.'}</p>
            ) : (
              <div className="divide-y divide-line/70">
                {todayTasks.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                ))}
              </div>
            )}
            {!p.readOnly && p.prefs.quick && <QuickAdd onTask={p.onQuickTask} onNote={p.onQuickNote} />}
            <button type="button" className="mt-3 text-sm font-semibold text-accent hover:underline" onClick={p.onGoTasks}>
              Alle Aufgaben
            </button>
          </section>
        )}

        {/* 3b. Nächste Tage */}
        {p.prefs.days && (
          <section className={`rounded-2xl bg-surface p-5 md:p-6 lg:self-start ${p.prefs.tasks ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
            <h2 className="h-section mb-3">Nächste Tage</h2>
            <ol className="space-y-1">
              {days.map((d) => (
                <li key={d.date.getTime()}>
                  <button type="button" onClick={() => p.onOpenDay(d.date)} className="flex w-full gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface2">
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-xs text-muted">{fmtShortDay.format(d.date).replace('.', '')}</span>
                      <span className="h-display tnum block text-xl leading-tight">{d.date.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1 space-y-1 pt-0.5">
                      {d.items.length === 0 && <span className="block pt-1.5 text-sm text-muted">Frei</span>}
                      {d.items.slice(0, 3).map((e) => (
                        <span key={e.id} className={`${catClass(e.category)} flex items-center gap-2 text-sm`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.kind === 'task' ? 'border border-cat' : 'bg-cat'}`} aria-hidden="true" />
                          {!e.allDay && <span className="tnum shrink-0 text-muted">{formatTime(e.start)}</span>}
                          <span className={`truncate ${e.kind === 'exam' ? 'font-semibold' : ''}`}>{e.title}</span>
                        </span>
                      ))}
                      {d.items.length > 3 && <span className="block text-xs text-muted">{d.items.length - 3} weitere</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 4. Woche */}
        {p.prefs.plan && (
          <section className={`rounded-2xl bg-surface p-5 md:p-6 ${hasSide ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
            <h2 className="h-section mb-4">Deine Woche</h2>
            <WeekStrip events={events} now={now} onPickDay={p.onOpenDay} />
          </section>
        )}

        {hasSide && (
          <div className={`flex flex-col gap-5 lg:gap-6 ${p.prefs.plan ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
            {notes.length > 0 && (
              <section className="rounded-2xl bg-surface2 p-5">
                <h2 className="h-section mb-2">Notizen für heute</h2>
                <div className="space-y-2">
                  {notes.map((n) => (
                    <button key={n.id} type="button" onClick={() => p.onOpen(n)} className={`${catClass(n.category)} block w-full rounded-md border-l-[3px] border-cat bg-surface px-3 py-2.5 text-left transition-colors hover:bg-canvas`}>
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      {n.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.description}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {p.prefs.training && training && (
              <button type="button" onClick={p.onGoTraining} className="cat-training flex items-center gap-4 rounded-2xl bg-cat/10 p-5 text-left transition-colors hover:bg-cat/15">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cat text-surface">
                  <Icon name={sportIcon(training.sport)} size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-muted">Nächstes Training</span>
                  <span className="block truncate font-semibold">{training.title}</span>
                  <span className="tnum block text-sm text-muted">
                    {formatEventTime(training, true).split(' · ')[0]}
                    {training.plannedMinutes ? `, ${formatDuration(training.plannedMinutes)}` : ''}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Nächste Prüfung: farbig hervorgehoben, mit Countdown und Lernfortschritt. */
function ExamSpotlight({ exam, tasks, now, onOpen, more, onAll }: { exam: Exam; tasks: Task[]; now: Date; onOpen: () => void; more: number; onAll: () => void }) {
  const days = daysUntil(exam, now)
  const done = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length > 0 ? done / tasks.length : exam.prepStatus === 'ready' ? 1 : 0
  return (
    <section className="relative overflow-hidden rounded-2xl bg-exam p-6 text-white">
      <span className="pointer-events-none absolute -bottom-10 -right-8 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
      <button type="button" onClick={onOpen} className="relative block w-full text-left">
        <span className="text-sm text-white/75">Nächste Prüfung</span>
        <span className="mt-2 flex items-end justify-between gap-4">
          <span className="min-w-0">
            <span className="h-display block truncate text-2xl leading-tight">{exam.title}</span>
            <span className="tnum mt-1 block text-sm text-white/80">
              {exam.start.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}, {formatTime(exam.start)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="h-display tnum block text-[44px] leading-none">{days}</span>
            <span className="block text-xs text-white/80">{days === 1 ? 'Tag' : 'Tage'}</span>
          </span>
        </span>
        <span className="mt-5 block h-2 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <span className="anim-grow block h-full rounded-full bg-white" style={{ width: `${Math.max(progress * 100, 3)}%` }} />
        </span>
        <span className="mt-2 flex justify-between text-xs text-white/85">
          <span>{PREP_LABEL[exam.prepStatus]}</span>
          <span className="tnum">{tasks.length > 0 ? `${done} von ${tasks.length} Lernaufgaben` : 'Noch keine Lernaufgaben'}</span>
        </span>
      </button>
      {more > 0 && (
        <button type="button" onClick={onAll} className="relative mt-4 text-sm font-semibold text-white underline-offset-4 hover:underline">
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
      <div className="flex items-center gap-1 rounded-full border border-line bg-canvas pl-1.5 pr-1 focus-within:border-accent">
        <button
          type="button"
          onClick={() => setAsNote((v) => !v)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface2 hover:text-ink"
          aria-label={asNote ? 'Als Notiz speichern, umschalten zu Aufgabe' : 'Als Aufgabe speichern, umschalten zu Notiz'}
        >
          <Icon name={asNote ? 'note' : 'tasks'} size={15} /> {asNote ? 'Notiz' : 'Aufgabe'}
        </button>
        <label htmlFor="quick" className="sr-only">
          Für heute festhalten
        </label>
        <input
          id="quick"
          className="min-h-11 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={asNote ? 'Notiz für heute …' : 'Aufgabe für heute …'}
          value={text}
          maxLength={200}
          onChange={(e) => {
            setText(e.target.value)
            if (state !== 'busy') setState('idle')
          }}
        />
        <button type="submit" className="btn-primary h-9 min-h-9 w-9 shrink-0 px-0" disabled={state === 'busy' || !text.trim()} aria-label="Speichern">
          <Icon name="plus" size={17} />
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
