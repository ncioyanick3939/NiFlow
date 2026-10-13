import type { Exam } from '../../domain/exams'
import { colorClass, useLabelsCtx } from '../labels'
import { formatDue, isOverdue } from '../../domain/tasks'
import type { Task } from '../../domain/tasks'
import { formatDuration } from '../../domain/dateUtils'
import Icon from '../icons'
import { CATEGORY_LABEL, CategoryDot, PriorityTag } from '../kit'

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
  medium: 'border-muted',
  low: 'border-muted/50',
}

/** Eine Aufgabe mit Abhak-Kästchen. Rahmenfarbe zeigt die Priorität, hohe Prioritäten zusätzlich als Text. */
export default function TaskRow({ task: t, now, exam, readOnly, onToggle, onOpen, compact }: Props) {
  const done = t.status === 'done'
  const overdue = isOverdue(t, now)
  const due = formatDue(t, now)
  const { byId } = useLabelsCtx()
  const label = t.labelId ? byId.get(t.labelId) : undefined
  return (
    <div className="group flex items-start gap-1 transition-colors duration-150 hover:bg-surface2/50">
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
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-sm border-[1.5px] transition-colors duration-150 ${
            done ? 'anim-pop border-ink bg-ink text-canvas' : `${RING[t.priority]} group-hover:border-ink`
          }`}
        >
          {done && <Icon name="check" size={12} />}
        </span>
      </button>
      <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 py-2.5 pr-2 text-left">
        <span className={`line-clamp-2 block break-words text-[15px] leading-snug ${done ? 'text-muted line-through' : 'font-medium'}`}>{t.title}</span>
        {!compact || due || exam ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {due ? <span className={`tnum ${overdue ? 'font-medium text-danger' : ''}`}>{overdue ? `Überfällig · ${due}` : due}</span> : !compact && !done && <span>Ohne Datum</span>}
            {t.status === 'in_progress' && <span className="font-medium text-ink">In Bearbeitung</span>}
            {!done && <PriorityTag p={t.priority} />}
            {exam && (
              <span className="inline-flex items-center gap-1">
                <Icon name="exam" size={12} /> {exam.subject || exam.title}
              </span>
            )}
            {t.estimateMinutes && <span className="tnum">≈ {formatDuration(t.estimateMinutes)}</span>}
            {label ? (
              <span className={`${colorClass(t.category, label)} inline-flex items-center gap-1.5 font-medium text-ink`}>
                <span className="h-2 w-2 rotate-45 bg-cat" aria-hidden="true" />
                {label.name}
              </span>
            ) : (
              !compact && (
                <span className="inline-flex items-center gap-1.5">
                  <CategoryDot category={t.category} />
                  {CATEGORY_LABEL[t.category]}
                </span>
              )
            )}
            {done && t.completedAt && <span>erledigt <span className="tnum">{t.completedAt.toLocaleDateString('de-CH')}</span></span>}
          </span>
        ) : null}
      </button>
    </div>
  )
}
