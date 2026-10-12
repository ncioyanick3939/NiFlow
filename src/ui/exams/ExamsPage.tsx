import { formatTime } from '../../domain/dateUtils'
import { PREP_LABEL, daysUntil } from '../../domain/exams'
import type { Exam } from '../../domain/exams'
import type { Task } from '../../domain/tasks'
import type { CalendarEvent } from '../../domain/types'
import Icon from '../icons'
import { EmptyState } from '../kit'
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
}

const fmt = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'long' })

export default function ExamsPage({ exams, tasks, sessions, now, loading, error, readOnly, onOpen, onCreate }: Props) {
  const upcoming = exams.filter((x) => daysUntil(x, now) >= 0).sort((a, b) => a.start.getTime() - b.start.getTime())
  const past = exams.filter((x) => daysUntil(x, now) < 0).sort((a, b) => b.start.getTime() - a.start.getTime())

  const row = (x: Exam) => {
    const days = daysUntil(x, now)
    const mine = tasks.filter((t) => t.examId === x.id)
    const open = mine.filter((t) => t.status !== 'done').length
    const plannedSessions = sessions.filter((e) => e.examId === x.id && e.start >= now).length
    const urgent = days >= 0 && days <= 3
    const soon = days > 3 && days <= 7
    return (
      <li key={x.id}>
        <button type="button" onClick={() => onOpen(x)} className="flex w-full items-stretch gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface2">
          <span className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-md ${urgent ? 'bg-danger/10 text-danger' : soon ? 'bg-[rgb(var(--private)/0.12)]' : 'bg-surface2'}`}>
            <span className="tnum text-xl font-semibold leading-none">{days < 0 ? '–' : days}</span>
            <span className="mt-0.5 text-[10px] font-medium">{days < 0 ? 'vorbei' : days === 1 ? 'Tag' : 'Tage'}</span>
          </span>
          <span className="min-w-0 flex-1 py-0.5">
            <span className="block truncate font-medium">{x.title}</span>
            <span className="tnum block text-sm text-muted">
              {fmt.format(x.start).replace(/\./g, '')} · {formatTime(x.start)}
              {x.subject && x.subject !== x.title ? ` · ${x.subject}` : ''}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${x.prepStatus === 'ready' ? 'bg-[rgb(var(--study)/0.15)]' : x.prepStatus === 'in_progress' ? 'bg-accent/10 text-accent' : 'bg-surface2 text-muted'}`}>
                {PREP_LABEL[x.prepStatus]}
              </span>
              {mine.length > 0 && (
                <span className={open > 0 && urgent ? 'font-semibold text-danger' : 'text-muted'}>
                  {open > 0 ? `${open} offene Lernaufgabe${open > 1 ? 'n' : ''}` : 'Alle Lernaufgaben erledigt'}
                </span>
              )}
              {plannedSessions > 0 && <span className="text-muted">{plannedSessions} Lerntermin{plannedSessions > 1 ? 'e' : ''} geplant</span>}
            </span>
          </span>
          <span className="hidden shrink-0 self-center text-sm font-medium text-muted sm:block">{countdownLabel(days)}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-[1.75rem] font-semibold leading-tight tracking-tight">Prüfungen</h1>
        {!readOnly && (
          <button type="button" className="btn-primary hidden md:inline-flex" onClick={onCreate}>
            <Icon name="plus" size={16} /> Neue Prüfung
          </button>
        )}
      </div>
      {error && <p className="mb-4 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-sm" role="alert">{error}</p>}
      {loading && exams.length === 0 ? (
        <p className="py-8 text-sm text-muted">Lädt Prüfungen …</p>
      ) : upcoming.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon="exam"
            title="Keine anstehenden Prüfungen"
            text="Lege eine Prüfung an. Danach kannst du Lernaufgaben und Lerntermine dazu planen."
            action={!readOnly && <button type="button" className="btn-primary" onClick={onCreate}>Prüfung anlegen</button>}
          />
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">{upcoming.map(row)}</ul>
      )}
      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Vergangene Prüfungen ({past.length})</summary>
          <ul className="-mx-2 mt-2 space-y-1 opacity-70">{past.map(row)}</ul>
        </details>
      )}
    </div>
  )
}
