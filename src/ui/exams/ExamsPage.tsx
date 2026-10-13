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

      {error && <p className="mb-4 border-l-2 border-danger bg-surface px-4 py-3 text-sm" role="alert">{error}</p>}

      {loading && exams.length === 0 ? (
        <p className="py-8 text-sm text-muted">Lädt Prüfungen …</p>
      ) : !first ? (
        <div className="rounded border border-line bg-surface">
          <EmptyState
            icon="exam"
            title="Keine anstehenden Prüfungen"
            text="Lege eine Prüfung an. Danach planst du Lernaufgaben und Lerntermine direkt dazu."
            action={!readOnly && <button type="button" className="btn-primary" onClick={onCreate}>Prüfung anlegen</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
          {/* Nächste Prüfung */}
          {(() => {
            const s = stats(first)
            const days = daysUntil(first, now)
            const openTasks = sortTasks(s.mine.filter((t) => t.status !== 'done'), 'due').slice(0, 4)
            return (
              <section className="rule grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 lg:col-span-12 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]" aria-label="Nächste Prüfung">
                <button type="button" onClick={() => onOpen(first)} className="group min-w-0 text-left">
                  <span className="text-sm text-muted">Als Nächstes</span>
                  <span className="mt-2 flex items-start justify-between gap-6">
                    <span className="min-w-0">
                      <span className="h-display block break-words text-[30px] leading-[1.08] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 md:text-[38px]">{first.title}</span>
                      {first.subject && first.subject !== first.title && <span className="mt-1 block text-[15px] text-muted">{first.subject}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`tnum block text-[56px] font-medium leading-[0.9] md:text-[72px] ${days <= 3 ? 'text-accent' : ''}`}>{days}</span>
                      <span className="block text-[13px] text-muted">{days === 0 ? 'heute' : days === 1 ? 'Tag' : 'Tage'}</span>
                    </span>
                  </span>
                  <dl className="mt-5 grid grid-cols-[6rem,minmax(0,1fr)] gap-y-1.5 border-t border-line pt-3 text-sm">
                    <dt className="text-muted">Datum</dt>
                    <dd className="tnum capitalize">
                      {fmtDate.format(first.start)}, {formatTime(first.start)}
                      {first.end ? `–${formatTime(first.end)}` : ''}
                    </dd>
                    {first.location && (
                      <>
                        <dt className="text-muted">Ort</dt>
                        <dd>{first.location}</dd>
                      </>
                    )}
                    {first.format && (
                      <>
                        <dt className="text-muted">Format</dt>
                        <dd>{first.format}</dd>
                      </>
                    )}
                    <dt className="text-muted">Stand</dt>
                    <dd>
                      {PREP_LABEL[first.prepStatus]}
                      {days <= 3 && <span className="ml-2 font-medium text-accent">Bald</span>}
                    </dd>
                  </dl>
                  <span className="mt-4 block h-[2px] bg-line" aria-hidden="true">
                    <span className="anim-grow block h-full bg-ink" style={{ width: `${Math.max(s.progress * 100, 2)}%` }} />
                  </span>
                  <span className="tnum mt-1.5 block text-xs text-muted">{s.mine.length ? `${s.done} von ${s.mine.length} Lernaufgaben erledigt` : 'Noch keine Lernaufgaben'}</span>
                </button>

                <div className="min-w-0 lg:border-l lg:border-line lg:pl-10">
                  <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                    <h2 className="h-section">Offene Lernaufgaben</h2>
                    <span className="tnum text-xs text-muted">{s.planned > 0 ? `${s.planned} Lerntermin${s.planned > 1 ? 'e' : ''} geplant` : 'Kein Lerntermin geplant'}</span>
                  </div>
                  {openTasks.length === 0 ? (
                    <p className="py-3 text-sm text-muted">{s.mine.length ? 'Alle Lernaufgaben erledigt.' : 'Noch keine Lernaufgaben. Im Detail kannst du dir einen Lernplan vorschlagen lassen.'}</p>
                  ) : (
                    <div className="divide-y divide-line">
                      {openTasks.map((t) => (
                        <TaskRow key={t.id} task={t} now={now} readOnly={readOnly} onToggle={onToggleTask} onOpen={onOpenTask} compact />
                      ))}
                    </div>
                  )}
                  <button type="button" className="mt-2 min-h-11 text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink" onClick={() => onOpen(first)}>
                    Lernplan und Details öffnen
                  </button>
                </div>
              </section>
            )
          })()}

          {/* Weitere Prüfungen als Fahrplan: Datum, Titel, Stand, Countdown */}
          {rest.length > 0 && (
            <section className="rule lg:col-span-12">
              <h2 className="h-section mb-1">Danach</h2>
              <ol className="divide-y divide-line border-b border-line">
                {rest.map((x) => {
                  const s = stats(x)
                  const days = daysUntil(x, now)
                  const u = urgency(days)
                  return (
                    <li key={x.id}>
                      <button type="button" onClick={() => onOpen(x)} className="grid w-full grid-cols-[4.25rem,minmax(0,1fr)] gap-4 py-3 text-left transition-colors duration-150 hover:bg-surface2/50 sm:grid-cols-[4.25rem,minmax(0,1fr),8rem]">
                        <span className="tnum text-[13px] leading-5">
                          <span className="block text-ink">
                            {String(x.start.getDate()).padStart(2, '0')}.{String(x.start.getMonth() + 1).padStart(2, '0')}.
                          </span>
                          <span className="block text-muted">{formatTime(x.start)}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium">{x.title}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-muted">
                            {x.subject && x.subject !== x.title ? `${x.subject} · ` : ''}
                            {PREP_LABEL[x.prepStatus]}
                            {s.open > 0 ? `, ${s.open} offen` : ''}
                          </span>
                          <span className="mt-2 block h-[2px] w-32 bg-line" aria-hidden="true">
                            <span className="block h-full bg-ink" style={{ width: `${Math.max(s.progress * 100, 3)}%` }} />
                          </span>
                          <span className={`tnum mt-1.5 block text-[13px] sm:hidden ${u === 'now' ? 'font-medium text-accent' : 'text-muted'}`}>{countdownLabel(days)}</span>
                        </span>
                        <span className={`tnum hidden text-right text-[13px] sm:block ${u === 'now' ? 'font-medium text-accent' : u === 'soon' ? 'text-ink' : 'text-muted'}`}>
                          {countdownLabel(days)}
                          {u === 'now' && <span className="block text-xs font-normal">Bald</span>}
                          {u === 'soon' && <span className="block text-xs text-muted">Diese Woche</span>}
                        </span>
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
          <summary className="min-h-11 cursor-pointer border-t border-line pt-3 text-sm font-medium text-muted hover:text-ink">Vergangene Prüfungen ({past.length})</summary>
          <ul className="mt-1 divide-y divide-line">
            {past.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onOpen(x)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface2/50">
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
