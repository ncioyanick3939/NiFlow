import { useState } from 'react'
import { evClass } from './labels'
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
import { formatEventTime } from './kit'
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

  const quickActions: { label: string; icon: IconName; go: () => void }[] = [
    { label: 'Aufgabe', icon: 'tasks', go: p.onCreateTask },
    { label: 'Termin', icon: 'calendar', go: () => p.onCreate(today) },
    { label: 'Notiz', icon: 'note', go: () => p.onCreateNote(today) },
    { label: 'Prüfung', icon: 'exam', go: p.onCreateExam },
  ]

  // Tagesplan: ganztägige Einträge oben, dann chronologisch, mit «Jetzt»-Linie und freiem Fenster
  type Row = { type: 'event'; e: CalendarEvent; past: boolean } | { type: 'now' } | { type: 'free' }
  const rows: Row[] = []
  let nowPlaced = false
  let freePlaced = !nextFree
  for (const e of timed) {
    const past = (e.end ?? e.start) < now
    if (!freePlaced && nextFree && nextFree.start <= e.start) {
      if (!nowPlaced && nextFree.start >= now) {
        rows.push({ type: 'now' })
        nowPlaced = true
      }
      rows.push({ type: 'free' })
      freePlaced = true
    }
    if (!nowPlaced && e.start > now) {
      rows.push({ type: 'now' })
      nowPlaced = true
    }
    rows.push({ type: 'event', e, past })
  }
  if (!nowPlaced) rows.push({ type: 'now' })
  if (!freePlaced) rows.push({ type: 'free' })

  const openCount = todayTasks.length + overdue.length
  const status = [
    `${timed.length} ${timed.length === 1 ? 'Termin' : 'Termine'}`,
    `${remaining.length} noch offen`,
    `${openCount} ${openCount === 1 ? 'Aufgabe' : 'Aufgaben'}`,
    ...(overdue.length > 0 ? [`${overdue.length} überfällig`] : []),
  ]

  const showAside = p.prefs.exams || overdue.length + urgentDeadlines.length + soonImportant.length > 0 || notes.length > 0 || (p.prefs.training && !!training)

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10 lg:px-10">
      {/* Kopf: Datum gross, darunter nächster Termin und Tagesstatus */}
      <header className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 border-b border-line pb-6 md:pb-8 lg:grid-cols-[minmax(0,1fr),minmax(0,22rem)]">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting(now)}
            {p.firstName ? `, ${p.firstName}` : ''}
          </p>
          <h1 className="h-display mt-1 text-[34px] leading-[1.05] md:text-[48px]">
            <span className="capitalize">{formatWeekday(now)}</span>
            <span className="text-muted">, {formatDateLong(now).replace(/ \d{4}$/, '')}</span>
          </h1>
          <p className="tnum mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span>KW {isoWeek(now)}</span>
            {status.map((x) => (
              <span key={x} className={x.includes('überfällig') ? 'font-medium text-danger' : ''}>
                {x}
              </span>
            ))}
          </p>
        </div>

        <div className="min-w-0 lg:border-l lg:border-line lg:pl-8">
          <p className="text-sm text-muted">{next ? 'Als Nächstes' : 'Heute'}</p>
          {next ? (
            <button type="button" onClick={() => p.onOpen(next)} className="group mt-1 block w-full text-left">
              <span className="flex items-baseline justify-between gap-4">
                <span className="tnum text-[15px] text-ink">{formatEventTime(next, startOfDay(next.start).getTime() !== today.getTime())}</span>
                <span className="tnum shrink-0 text-[15px] font-medium text-accent">{formatCountdown(now, next.start)}</span>
              </span>
              <span className="mt-1 block truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{next.title}</span>
              <span className={`${evClass(next)} mt-1.5 inline-flex items-center gap-2 text-[13px] text-muted`}>
                <span className="h-2 w-2 bg-cat" aria-hidden="true" />
                {next.labelName ?? CATEGORY_LABEL[next.category]}
              </span>
            </button>
          ) : (
            <p className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{p.loading ? 'Lädt …' : 'Keine weiteren Termine'}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {!p.readOnly &&
            quickActions.map((a) => (
              <button key={a.label} type="button" onClick={a.go} className="btn-outline min-h-11 flex-1 px-3.5 sm:flex-none">
                <Icon name="plus" size={15} /> {a.label}
              </button>
            ))}
          <button type="button" onClick={p.onSearch} className="btn-outline h-11 w-11 px-0 md:hidden" aria-label="Suchen">
            <Icon name="search" size={17} />
          </button>
        </div>
      </header>

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 pt-8 ${showAside ? 'lg:grid-cols-[minmax(0,1fr),minmax(0,22rem)]' : ''}`}>
        {/* Tagesplan */}
        <section aria-labelledby="plan-h" className="min-w-0">
          <div className="mb-3 flex items-baseline gap-4">
            <h2 id="plan-h" className="h-section mr-auto">
              Tagesplan
            </h2>
            <button type="button" className="min-h-11 text-sm font-medium text-muted hover:text-ink" onClick={() => p.onOpenDay(today)}>
              Im Kalender öffnen
            </button>
          </div>

          <DayRiver timed={timed} free={p.prefs.free ? free : []} day={today} now={now} onOpen={p.onOpen} />

          {allDay.length > 0 && (
            <ul className="mt-5 border-t border-line">
              {allDay.map((e) => (
                <li key={e.id} className="border-b border-line">
                  <button type="button" onClick={() => p.onOpen(e)} className={`${evClass(e)} grid min-h-12 w-full grid-cols-[4.5rem,minmax(0,1fr)] items-center gap-3 py-2 text-left transition-colors duration-150 hover:bg-surface2/60`}>
                    <span className="tnum text-[13px] text-muted">Ganztägig</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-4 w-[3px] shrink-0 bg-cat" aria-hidden="true" />
                      <span className="truncate text-[15px]">{e.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ol className={`${allDay.length > 0 ? '' : 'mt-5 border-t border-line'}`}>
            {timed.length === 0 && !p.loading && <li className="border-b border-line py-4 text-sm text-muted">Heute keine Termine mit Uhrzeit.</li>}
            {rows.map((r, i) => {
              if (r.type === 'now')
                return timed.length === 0 ? null : (
                  <li key={`now-${i}`} className="relative flex items-center gap-3 py-1" aria-label={`Jetzt, ${formatTime(now)}`}>
                    <span className="tnum w-[4.5rem] shrink-0 text-[13px] font-medium text-accent">{formatTime(now)}</span>
                    <span className="h-px flex-1 bg-accent" aria-hidden="true" />
                  </li>
                )
              if (r.type === 'free')
                return nextFree ? (
                  <li key={`free-${i}`} className="grid grid-cols-[4.5rem,minmax(0,1fr)] items-center gap-3 border-b border-dashed border-line py-2.5">
                    <span className="tnum text-[13px] text-muted">{formatTime(nextFree.start)}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 text-sm text-muted">
                      <span>
                        Frei bis <span className="tnum">{formatTime(nextFree.end)}</span>
                        {nextFree.study ? ', genug für einen Lernblock' : ''}
                      </span>
                      {!p.readOnly && (
                        <button type="button" className="min-h-11 font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink" onClick={() => p.onCreate(today, nextFree.study?.start ?? nextFree.start)}>
                          Einplanen
                        </button>
                      )}
                    </span>
                  </li>
                ) : null
              const e = r.e
              return (
                <li key={e.id} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() => p.onOpen(e)}
                    className={`${evClass(e)} grid min-h-14 w-full grid-cols-[4.5rem,minmax(0,1fr)] items-start gap-3 py-3 text-left transition-colors duration-150 hover:bg-surface2/60 ${r.past ? 'text-muted' : ''}`}
                  >
                    <span className="tnum pt-0.5 text-[13px] leading-5">
                      <span className={r.past ? '' : 'text-ink'}>{formatTime(e.start)}</span>
                      {e.end && <span className="block text-muted">{formatTime(e.end)}</span>}
                    </span>
                    <span className="flex min-w-0 gap-2.5">
                      <span className={`mt-1 w-[3px] shrink-0 self-stretch ${r.past ? 'bg-cat/40' : 'bg-cat'}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className={`block truncate text-[15px] ${r.past ? '' : 'font-medium'}`}>
                          {e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
                          <span>{e.labelName ?? CATEGORY_LABEL[e.category]}</span>
                          {e.end && <span className="tnum">{formatDuration(Math.round((e.end.getTime() - e.start.getTime()) / 60000))}</span>}
                          {e.kind === 'deadline' && <span className="font-medium text-ink">Frist</span>}
                          {r.past && <span>vorbei</span>}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Seitenspalte: Prüfung, Dringendes, Training, Notizen */}
        {showAside && (
          <aside className="min-w-0 space-y-8 lg:border-l lg:border-line lg:pl-8">
            {p.prefs.exams &&
              (exam ? (
                <ExamSpotlight exam={exam} tasks={p.tasks.filter((t) => t.examId === exam.id)} now={now} onOpen={() => p.onOpenExam(exam)} more={upcomingExams.length - 1} onAll={p.onGoExams} />
              ) : (
                <section className="rule">
                  <h2 className="h-section">Keine Prüfung geplant</h2>
                  <p className="mt-1 text-sm text-muted">Trag die nächste Prüfung ein, dann plant NiFlow mit dir die Lernaufgaben.</p>
                  {!p.readOnly && (
                    <button type="button" className="btn-outline mt-3" onClick={p.onCreateExam}>
                      <Icon name="plus" size={15} /> Prüfung anlegen
                    </button>
                  )}
                </section>
              ))}

            {overdue.length + urgentDeadlines.length + soonImportant.length > 0 && (
              <section className="rule">
                <h2 className="h-section mb-1 flex items-baseline gap-2">
                  {overdue.length + urgentDeadlines.length > 0 ? 'Dringend' : 'Bald wichtig'}
                  {overdue.length + urgentDeadlines.length > 0 && <span className="tnum text-sm font-medium text-danger">{overdue.length + urgentDeadlines.length}</span>}
                </h2>
                <ul className="divide-y divide-line">
                  {urgentDeadlines.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => p.onOpen(e)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left transition-colors hover:bg-surface2/60">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                        <span className="tnum shrink-0 text-xs font-medium text-danger">Frist {formatCountdown(now, e.start)}</span>
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
              <section className="rule">
                <h2 className="h-section mb-2">Nächstes Training</h2>
                <button type="button" onClick={p.onGoTraining} className="cat-training flex w-full items-start gap-3 text-left">
                  <Icon name={sportIcon(training.sport)} size={18} className="mt-0.5 shrink-0 text-cat" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{training.title}</span>
                    <span className="tnum block text-[13px] text-muted">
                      {formatEventTime(training, true).split(' · ')[0]}
                      {training.plannedMinutes ? `, ${formatDuration(training.plannedMinutes)}` : ''}
                    </span>
                  </span>
                </button>
              </section>
            )}

            {notes.length > 0 && (
              <section className="rule">
                <h2 className="h-section mb-1">Notizen für heute</h2>
                <ul className="divide-y divide-line">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => p.onOpen(n)} className="block min-h-11 w-full py-2.5 text-left transition-colors hover:bg-surface2/60">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
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

      {/* Darunter: Aufgaben, nächste Tage, Woche */}
      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-12">
        {p.prefs.tasks && (
          <section className={`rule min-w-0 ${p.prefs.days ? 'lg:col-span-7' : 'lg:col-span-12'}`} aria-labelledby="tasks-h">
            <div className="mb-1 flex items-baseline gap-3">
              <h2 id="tasks-h" className="h-section mr-auto">
                Aufgaben für heute
              </h2>
              <span className="tnum text-[13px] text-muted">
                {todayTasks.length} offen{doneToday > 0 ? `, ${doneToday} erledigt` : ''}
              </span>
            </div>
            {todayTasks.length + doneToday > 0 && (
              <div className="mb-2 h-[2px] bg-line" aria-hidden="true">
                <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${(doneToday / (todayTasks.length + doneToday)) * 100}%` }} />
              </div>
            )}
            {todayTasks.length === 0 ? (
              <p className="py-3 text-sm text-muted">{doneToday > 0 ? 'Alles für heute erledigt.' : 'Für heute ist nichts fällig.'}</p>
            ) : (
              <div className="divide-y divide-line">
                {todayTasks.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
                ))}
              </div>
            )}
            {!p.readOnly && p.prefs.quick && <QuickAdd onTask={p.onQuickTask} onNote={p.onQuickNote} />}
            <button type="button" className="mt-2 min-h-11 text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink" onClick={p.onGoTasks}>
              Alle Aufgaben
            </button>
          </section>
        )}

        {p.prefs.days && (
          <section className={`rule min-w-0 ${p.prefs.tasks ? 'lg:col-span-5' : 'lg:col-span-12'}`} aria-labelledby="days-h">
            <h2 id="days-h" className="h-section mb-1">
              Nächste Tage
            </h2>
            <ol className="divide-y divide-line">
              {days.map((d) => (
                <li key={d.date.getTime()}>
                  <button type="button" onClick={() => p.onOpenDay(d.date)} className="grid w-full grid-cols-[3.25rem,minmax(0,1fr)] gap-3 py-2.5 text-left transition-colors hover:bg-surface2/60">
                    <span className="tnum text-[13px] leading-5">
                      <span className="block text-muted">{fmtShortDay.format(d.date).replace('.', '')}</span>
                      <span className="block text-ink">{String(d.date.getDate()).padStart(2, '0')}.{String(d.date.getMonth() + 1).padStart(2, '0')}.</span>
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      {d.items.length === 0 && <span className="block text-sm leading-5 text-muted">Frei</span>}
                      {d.items.slice(0, 3).map((e) => (
                        <span key={e.id} className={`${evClass(e)} flex items-center gap-2 text-sm leading-5`}>
                          <span className={`h-2 w-[3px] shrink-0 ${e.kind === 'task' ? 'bg-cat/40' : 'bg-cat'}`} aria-hidden="true" />
                          {!e.allDay && <span className="tnum shrink-0 text-muted">{formatTime(e.start)}</span>}
                          <span className={`truncate ${e.kind === 'exam' ? 'font-semibold' : ''}`}>{e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}</span>
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

        {p.prefs.plan && (
          <section className="rule min-w-0 lg:col-span-12" aria-labelledby="week-h">
            <h2 id="week-h" className="h-section mb-4">
              Deine Woche
            </h2>
            <WeekStrip events={events} now={now} onPickDay={p.onOpenDay} />
          </section>
        )}
      </div>
    </div>
  )
}

/** Nächste Prüfung: Countdown in Tagen, Datum, Lernfortschritt. Frist zusätzlich als Text. */
function ExamSpotlight({ exam, tasks, now, onOpen, more, onAll }: { exam: Exam; tasks: Task[]; now: Date; onOpen: () => void; more: number; onAll: () => void }) {
  const days = daysUntil(exam, now)
  const done = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length > 0 ? done / tasks.length : exam.prepStatus === 'ready' ? 1 : 0
  return (
    <section className="rule">
      <h2 className="h-section">Nächste Prüfung</h2>
      <button type="button" onClick={onOpen} className="group mt-2 block w-full text-left">
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block truncate text-[19px] font-semibold leading-tight tracking-[-0.015em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{exam.title}</span>
            <span className="tnum mt-1 block text-[13px] text-muted">
              {exam.start.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' })}, {formatTime(exam.start)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={`tnum block text-[34px] font-medium leading-none ${days <= 3 ? 'text-accent' : ''}`}>{days}</span>
            <span className="block text-xs text-muted">{days === 0 ? 'heute' : days === 1 ? 'Tag' : 'Tage'}</span>
          </span>
        </span>
        <span className="mt-4 block h-[2px] bg-line" aria-hidden="true">
          <span className="anim-grow block h-full bg-ink" style={{ width: `${Math.max(progress * 100, 2)}%` }} />
        </span>
        <span className="mt-2 flex justify-between gap-3 text-xs text-muted">
          <span>{PREP_LABEL[exam.prepStatus]}</span>
          <span className="tnum">{tasks.length > 0 ? `${done}/${tasks.length} Lernaufgaben` : 'Keine Lernaufgaben'}</span>
        </span>
      </button>
      {more > 0 && (
        <button type="button" onClick={onAll} className="mt-2 min-h-11 text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
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
      <div className="flex items-center gap-1 rounded border border-line bg-surface pl-1 pr-1 focus-within:border-ink">
        <button
          type="button"
          onClick={() => setAsNote((v) => !v)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface2 hover:text-ink"
          aria-label={asNote ? 'Als Notiz speichern, umschalten zu Aufgabe' : 'Als Aufgabe speichern, umschalten zu Notiz'}
        >
          <Icon name={asNote ? 'note' : 'tasks'} size={15} /> {asNote ? 'Notiz' : 'Aufgabe'}
        </button>
        <label htmlFor="quick" className="sr-only">
          Für heute festhalten
        </label>
        <input
          id="quick"
          className="min-h-11 min-w-0 flex-1 bg-transparent px-1 text-base outline-none md:text-sm placeholder:text-muted/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={asNote ? 'Notiz für heute …' : 'Aufgabe für heute …'}
          value={text}
          maxLength={200}
          onChange={(e) => {
            setText(e.target.value)
            if (state !== 'busy') setState('idle')
          }}
        />
        <button type="submit" className="btn-primary h-10 min-h-10 w-10 shrink-0 px-0" disabled={state === 'busy' || !text.trim()} aria-label="Speichern">
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
