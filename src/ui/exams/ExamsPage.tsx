import { formatTime } from '../../domain/dateUtils'
import { PREP_LABEL, daysUntil } from '../../domain/exams'
import type { Exam } from '../../domain/exams'
import { sortTasks } from '../../domain/tasks'
import type { Task } from '../../domain/tasks'
import type { CalendarEvent } from '../../domain/types'
import Icon from '../icons'
import { EmptyState } from '../kit'
import TaskRow from '../tasks/TaskRow'
import { countdownLabel } from './ExamDetail'

interface Props {
  exams: Exam[]
  tasks: Task[]
  sessions: CalendarEvent[]
  now: Date
  loading: boolean
  error: string | null
  readOnly: boolean
  onOpen: (x: Exam) => void
  onCreate: () => void
  onToggleTask: (t: Task) => void
  onOpenTask: (t: Task) => void
}

const fmtDate = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtMonth = new Intl.DateTimeFormat('de-CH', { month: 'short' })

function urgency(days: number): 'now' | 'soon' | 'later' | 'past' {
  if (days < 0) return 'past'
  if (days <= 3) return 'now'
  if (days <= 7) return 'soon'
  return 'later'
}

/**
 * Prüfungen: die nächste gross hervorgehoben (mit Lernaufgaben direkt zum Abhaken),
 * alle weiteren chronologisch auf einem Zeitstrahl.
 */
export default function ExamsPage({ exams, tasks, sessions, now, loading, error, readOnly, onOpen, onCreate, onToggleTask, onOpenTask }: Props) {
  const upcoming = exams.filter((x) => daysUntil(x, now) >= 0).sort((a, b) => a.start.getTime() - b.start.getTime())
  const past = exams.filter((x) => daysUntil(x, now) < 0).sort((a, b) => b.start.getTime() - a.start.getTime())
  const [first, ...rest] = upcoming
  const stats = (x: Exam) => {
    const mine = tasks.filter((t) => t.examId === x.id)
    const done = mine.filter((t) => t.status === 'done').length
    const planned = sessions.filter((e) => e.examId === x.id && e.start >= now).length
    return { mine, done, open: mine.length - done, planned, progress: mine.length ? done / mine.length : x.prepStatus === 'ready' ? 1 : 0 }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-end gap-3 md:mb-8">
        <div className="mr-auto">
          <h1 className="h-display text-[28px] leading-tight md:text-[34px]">Prüfungen</h1>
          <p className="mt-1 text-sm text-muted">{upcoming.length === 0 ? 'Keine anstehend' : `${upcoming.length} anstehend, nach Datum sortiert`}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn-primary" onClick={onCreate}>
            <Icon name="plus" size={16} /> Neue Prüfung
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-lg bg-danger/[0.08] px-4 py-3 text-sm" role="alert">{error}</p>}

      {loading && exams.length === 0 ? (
        <p className="py-8 text-sm text-muted">Lädt Prüfungen …</p>
      ) : !first ? (
        <div className="rounded-2xl bg-surface">
          <EmptyState
            icon="exam"
            title="Keine anstehenden Prüfungen"
            text="Lege eine Prüfung an. Danach planst du Lernaufgaben und Lerntermine direkt dazu."
            action={!readOnly && <button type="button" className="btn-primary" onClick={onCreate}>Prüfung anlegen</button>}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Nächste Prüfung */}
          {(() => {
            const s = stats(first)
            const days = daysUntil(first, now)
            const openTasks = sortTasks(s.mine.filter((t) => t.status !== 'done'), 'due').slice(0, 4)
            return (
              <section className="relative overflow-hidden rounded-2xl bg-exam text-white lg:col-span-12">
                <span className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/[0.08]" aria-hidden="true" />
                <div className="relative grid gap-6 p-6 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)] md:p-8">
                  <button type="button" onClick={() => onOpen(first)} className="text-left">
                    <span className="text-sm text-white/75">Als Nächstes</span>
                    <span className="h-display mt-1 block break-words text-[30px] leading-tight md:text-[38px]">{first.title}</span>
                    <span className="mt-2 block text-[15px] text-white/85">
                      {first.subject && first.subject !== first.title ? `${first.subject}, ` : ''}
                      {fmtDate.format(first.start)}, {formatTime(first.start)}
                      {first.end ? `–${formatTime(first.end)}` : ''}
                    </span>
                    {(first.location || first.format) && <span className="mt-0.5 block text-sm text-white/70">{[first.location, first.format].filter(Boolean).join(', ')}</span>}
                    <span className="mt-6 flex items-end gap-6">
                      <span>
                        <span className="h-display tnum block text-[64px] leading-[0.9]">{days}</span>
                        <span className="text-sm text-white/80">{days === 1 ? 'Tag' : 'Tage'} bis zur Prüfung</span>
                      </span>
                      <span className="mb-1 flex-1">
                        <span className="mb-1.5 flex justify-between text-xs text-white/85">
                          <span>{PREP_LABEL[first.prepStatus]}</span>
                          <span className="tnum">{s.mine.length ? `${s.done}/${s.mine.length}` : ''}</span>
                        </span>
                        <span className="block h-2.5 overflow-hidden rounded-full bg-white/20">
                          <span className="anim-grow block h-full rounded-full bg-white" style={{ width: `${Math.max(s.progress * 100, 3)}%` }} />
                        </span>
                      </span>
                    </span>
                  </button>

                  <div className="rounded-xl bg-surface p-3 text-ink">
                    <div className="flex items-center justify-between px-2 pb-1 pt-1">
                      <h2 className="text-sm font-semibold">Offene Lernaufgaben</h2>
                      <span className="tnum text-xs text-muted">{s.planned > 0 ? `${s.planned} Lerntermin${s.planned > 1 ? 'e' : ''} geplant` : 'Kein Lerntermin geplant'}</span>
                    </div>
                    {openTasks.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted">{s.mine.length ? 'Alle Lernaufgaben erledigt.' : 'Noch keine Lernaufgaben. Im Detail kannst du dir einen Lernplan vorschlagen lassen.'}</p>
                    ) : (
                      <div className="divide-y divide-line/60">
                        {openTasks.map((t) => (
                          <TaskRow key={t.id} task={t} now={now} readOnly={readOnly} onToggle={onToggleTask} onOpen={onOpenTask} compact />
                        ))}
                      </div>
                    )}
                    <button type="button" className="mt-1 w-full rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-accent transition-colors hover:bg-surface2" onClick={() => onOpen(first)}>
                      Lernplan und Details öffnen
                    </button>
                  </div>
                </div>
              </section>
            )
          })()}

          {/* Zeitstrahl der weiteren Prüfungen */}
          {rest.length > 0 && (
            <section className="lg:col-span-12">
              <h2 className="h-section mb-3">Danach</h2>
              <ol className="relative space-y-2 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-0.5 before:rounded-full before:bg-line">
                {rest.map((x) => {
                  const s = stats(x)
                  const days = daysUntil(x, now)
                  const u = urgency(days)
                  return (
                    <li key={x.id} className="relative">
                      <button type="button" onClick={() => onOpen(x)} className="flex w-full items-center gap-4 rounded-xl bg-surface p-3 pr-4 text-left transition-colors hover:bg-surface2/60 md:gap-5">
                        <span
                          className={`relative z-10 flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center rounded-full ${
                            u === 'now' ? 'bg-danger text-white' : u === 'soon' ? 'bg-sun text-sunink' : 'cat-study bg-cat/15 text-ink'
                          }`}
                        >
                          <span className="h-display tnum text-lg leading-none">{x.start.getDate()}</span>
                          <span className="text-[10px] font-medium">{fmtMonth.format(x.start).replace('.', '')}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{x.title}</span>
                          <span className="block truncate text-sm text-muted">
                            {x.subject && x.subject !== x.title ? `${x.subject}, ` : ''}
                            {formatTime(x.start)} Uhr
                          </span>
                          <span className="mt-1.5 flex items-center gap-3">
                            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                              <span className="cat-study block h-full rounded-full bg-cat" style={{ width: `${Math.max(s.progress * 100, 4)}%` }} />
                            </span>
                            <span className="text-xs text-muted">
                              {PREP_LABEL[x.prepStatus]}
                              {s.open > 0 ? `, ${s.open} offen` : ''}
                            </span>
                          </span>
                        </span>
                        <span className={`tnum hidden shrink-0 text-sm font-semibold sm:block ${u === 'now' ? 'text-danger' : 'text-muted'}`}>{countdownLabel(days)}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">Vergangene Prüfungen ({past.length})</summary>
          <ul className="mt-3 space-y-1">
            {past.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onOpen(x)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface">
                  <Icon name="exam" size={16} />
                  <span className="flex-1 truncate">{x.title}</span>
                  <span className="tnum">{x.start.toLocaleDateString('de-CH')}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
