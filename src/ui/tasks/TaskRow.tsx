import type { Exam } from '../../domain/exams'
import { colorClass, useLabelsCtx } from '../labels'
import { formatDue, isOverdue } from '../../domain/tasks'
import type { Task } from '../../domain/tasks'
import { formatDuration } from '../../domain/dateUtils'
import Icon from '../icons'
import { CategoryDot, PriorityTag } from '../kit'

interface Props {
  task: Task
  now: Date
  exam?: Exam
  readOnly: boolean
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  compact?: boolean
}

const RING: Record<Task['priority'], string> = {
  urgent: 'border-danger',
  high: 'border-warn',
  medium: 'border-muted/60',
  low: 'border-line',
}

/** Eine Aufgabe mit Abhak-Kreis. Der Kreis zeigt die Priorität als Farbe. */
export default function TaskRow({ task: t, now, exam, readOnly, onToggle, onOpen, compact }: Props) {
  const done = t.status === 'done'
  const overdue = isOverdue(t, now)
  const due = formatDue(t, now)
  const { byId } = useLabelsCtx()
  const label = t.labelId ? byId.get(t.labelId) : undefined
  return (
    <div className="group flex items-start gap-1 rounded-lg transition-colors hover:bg-surface2/70">
      <button
        type="button"
        onClick={() => onToggle(t)}
        disabled={readOnly}
        aria-label={done ? `«${t.title}» wieder öffnen` : `«${t.title}» erledigt`}
        aria-pressed={done}
        className="flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-default"
      >
        <span
          key={done ? 'done' : 'open'}
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
            done ? 'anim-pop border-accent bg-accent text-accentink' : `${RING[t.priority]} group-hover:border-accent group-hover:bg-accent/10`
          }`}
        >
          {done && <Icon name="check" size={12} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 py-2.5 pr-2 text-left">
        <span className={`line-clamp-2 block break-words text-[15px] leading-snug ${done ? 'text-muted line-through' : 'font-medium'}`}>{t.title}</span>
        {!compact || due || exam ? (
          <span className="tnum mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            {due ? <span className={overdue ? 'font-semibold text-danger' : ''}>{overdue ? `Überfällig · ${due}` : due}</span> : !compact && !done && <span>Ohne Datum</span>}
            {t.status === 'in_progress' && <span className="font-medium text-accent">In Bearbeitung</span>}
            {!done && <PriorityTag p={t.priority} />}
            {exam && (
              <span className="inline-flex items-center gap-1">
                <Icon name="exam" size={12} /> {exam.subject || exam.title}
              </span>
            )}
            {t.estimateMinutes && <span>≈ {formatDuration(t.estimateMinutes)}</span>}
            {label ? (
              <span className={`${colorClass(t.category, label)} inline-flex items-center gap-1.5 font-medium text-ink`}>
                <span className="h-2 w-2 rotate-45 rounded-[2px] bg-cat" aria-hidden="true" />
                {label.name}
              </span>
            ) : (
              !compact && <CategoryDot category={t.category} />
            )}
            {done && t.completedAt && <span>erledigt {t.completedAt.toLocaleDateString('de-CH')}</span>}
          </span>
        ) : null}
      </button>
    </div>
  )
}
