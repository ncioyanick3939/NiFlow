import { formatTime } from '../../domain/dateUtils'
import { PREP_LABEL, daysUntil } from '../../domain/exams'
import type { Exam } from '../../domain/exams'
import { sortTasks } from '../../domain/tasks'
import type { Task } from '../../domain/tasks'
import type { CalendarEvent } from '../../domain/types'
import Icon from '../icons'
import { EmptyState } from '../kit'
import TaskRow from '../tasks/TaskRow'
import ExamCard from './ExamCard'

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
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-36 pt-5 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-end gap-3 md:mb-8">
        <div className="mr-auto">
          <h1 className="h-display text-[30px] leading-tight md:text-[38px]">Prüfungen</h1>
          <p className="mt-1 text-sm text-muted">{upcoming.length === 0 ? 'Keine anstehend' : `${upcoming.length} anstehend, nach Datum sortiert`}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn-primary" onClick={onCreate}>
            <Icon name="plus" size={16} /> Neue Prüfung
          </button>
        )}
      </header>

      {error && <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm" role="alert">{error}</p>}

      {loading && exams.length === 0 ? (
        <p className="py-8 text-sm text-muted">Lädt Prüfungen …</p>
      ) : !first ? (
        <div className="rounded-3xl bg-surface shadow-card">
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
              <section className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:col-span-12 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]" aria-label="Nächste Prüfung">
                <button type="button" onClick={() => onOpen(first)} className="group min-w-0 rounded-3xl bg-deep p-5 text-left text-deepink shadow-float md:p-7">
                  <span className="text-sm font-bold text-deepmuted">Als Nächstes</span>
                  <span className="mt-2 flex items-start justify-between gap-6">
                    <span className="min-w-0">
                      <span className="h-display block break-words text-[30px] leading-[1.08] md:text-[36px]">{first.title}</span>
                      {first.subject && first.subject !== first.title && <span className="mt-1 block text-[15px] font-medium text-deepmuted">{first.subject}</span>}
                    </span>
                    <span className="shrink-0 rounded-3xl bg-sun px-5 py-3 text-center text-sunink">
                      <span className="tnum block text-[44px] font-extrabold leading-[0.95] md:text-[56px]">{days}</span>
                      <span className="block text-[13px] font-bold">{days === 0 ? 'heute' : days === 1 ? 'Tag' : 'Tage'}</span>
                    </span>
                  </span>
                  <dl className="mt-5 grid grid-cols-[6rem,minmax(0,1fr)] gap-y-1.5 border-t border-deepink/15 pt-3 text-sm">
                    <dt className="text-deepmuted">Datum</dt>
                    <dd className="tnum capitalize">
                      {fmtDate.format(first.start)}, {formatTime(first.start)}
                      {first.end ? `–${formatTime(first.end)}` : ''}
                    </dd>
                    {first.location && (
                      <>
                        <dt className="text-deepmuted">Ort</dt>
                        <dd>{first.location}</dd>
                      </>
                    )}
                    {first.format && (
                      <>
                        <dt className="text-deepmuted">Format</dt>
                        <dd>{first.format}</dd>
                      </>
                    )}
                    <dt className="text-deepmuted">Stand</dt>
                    <dd>
                      {PREP_LABEL[first.prepStatus]}
                      {days <= 3 && <span className="ml-2 font-bold text-sun">Bald</span>}
                    </dd>
                  </dl>
                  <span className="mt-4 block h-2.5 overflow-hidden rounded-full bg-deepink/15" aria-hidden="true">
                    <span className="anim-grow block h-full rounded-full bg-sun" style={{ width: `${Math.max(s.progress * 100, 3)}%` }} />
                  </span>
                  <span className="tnum mt-1.5 block text-xs font-semibold text-deepmuted">{s.mine.length ? `${s.done} von ${s.mine.length} Lernaufgaben erledigt` : 'Noch keine Lernaufgaben'}</span>
                </button>

                <div className="rule min-w-0">
                  <div className="flex items-baseline justify-between gap-3 pb-2">
                    <h2 className="h-section">Offene Lernaufgaben</h2>
                    <span className="tnum text-xs text-muted">{s.planned > 0 ? `${s.planned} Lerntermin${s.planned > 1 ? 'e' : ''} geplant` : 'Kein Lerntermin geplant'}</span>
                  </div>
                  {openTasks.length === 0 ? (
                    <p className="py-3 text-sm text-muted">{s.mine.length ? 'Alle Lernaufgaben erledigt.' : 'Noch keine Lernaufgaben. Im Detail kannst du dir einen Lernplan vorschlagen lassen.'}</p>
                  ) : (
                    <div>
                      {openTasks.map((t) => (
                        <TaskRow key={t.id} task={t} now={now} readOnly={readOnly} onToggle={onToggleTask} onOpen={onOpenTask} compact />
                      ))}
                    </div>
                  )}
                  <button type="button" className="mt-2 min-h-11 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent/10" onClick={() => onOpen(first)}>
                    Lernplan und Details öffnen
                  </button>
                </div>
              </section>
            )
          })()}

          {/* Weitere Prüfungen: gleiche dunkle Karte wie im Dashboard */}
          {rest.length > 0 && (
            <section className="lg:col-span-12" aria-label="Weitere Prüfungen">
              <h2 className="h-section mb-3">Danach</h2>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((x) => (
                  <ExamCard key={x.id} exam={x} tasks={tasks.filter((t) => t.examId === x.id)} now={now} onOpen={() => onOpen(x)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-10">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-full px-1 text-sm font-bold text-muted hover:text-ink">Vergangene Prüfungen ({past.length})</summary>
          <ul className="mt-1 rounded-3xl bg-surface p-2 shadow-card">
            {past.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onOpen(x)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface2/70">
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
