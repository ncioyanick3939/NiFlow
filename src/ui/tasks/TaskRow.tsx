import type { Exam } from '../../domain/exams'
import { colorClass, useLabelsCtx } from '../labels'
import { formatDue, isOverdue } from '../../domain/tasks'
import type { Task } from '../../domain/tasks'
import { formatDuration } from '../../domain/dateUtils'
import Icon, { categoryIcon } from '../icons'
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
  urgent: 'border-danger bg-danger/10',
  high: 'border-warn bg-warn/10',
  medium: 'border-cat/80',
  low: 'border-cat/50',
}

/** Eine Aufgabe mit Abhak-Kästchen. Rahmenfarbe zeigt die Priorität, hohe Prioritäten zusätzlich als Text. */
export default function TaskRow({ task: t, now, exam, readOnly, onToggle, onOpen, compact }: Props) {
  const done = t.status === 'done'
  const overdue = isOverdue(t, now)
  const due = formatDue(t, now)
  const { byId } = useLabelsCtx()
  const label = t.labelId ? byId.get(t.labelId) : undefined
  return (
    <div className={`${colorClass(t.category, label)} group flex items-center gap-3 rounded-2xl py-1.5 pl-1 transition-colors duration-150 hover:bg-surface2/70`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface2 text-cat ${done ? 'opacity-50' : ''}`} aria-hidden="true">
        <Icon name={categoryIcon(t.category)} size={20} />
      </span>
      <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 py-1 text-left">
        <span className={`line-clamp-2 block break-words text-[17px] leading-snug tracking-[-0.01em] ${done ? 'text-muted line-through' : 'font-bold'}`}>{t.title}</span>
        {!compact || due || exam ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {due ? <span className={`tnum ${overdue ? 'font-bold text-danger' : ''}`}>{overdue ? `Überfällig · ${due}` : due}</span> : !compact && !done && <span>Ohne Datum</span>}
            {t.status === 'in_progress' && <span className="font-bold text-accent">In Bearbeitung</span>}
            {!done && <PriorityTag p={t.priority} />}
            {exam && (
              <span className="inline-flex items-center gap-1">
                <Icon name="exam" size={12} /> {exam.subject || exam.title}
              </span>
            )}
            {t.estimateMinutes && <span className="tnum">≈ {formatDuration(t.estimateMinutes)}</span>}
            {label && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-cat">
                <span className="h-2 w-2 rounded-full bg-cat" aria-hidden="true" />
                {label.name}
              </span>
            )}
            {!label && !compact && (
              <span className="inline-flex items-center gap-1.5">
                <CategoryDot category={t.category} />
                {CATEGORY_LABEL[t.category]}
              </span>
            )}
            {done && t.completedAt && <span>erledigt <span className="tnum">{t.completedAt.toLocaleDateString('de-CH')}</span></span>}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onToggle(t)}
        disabled={readOnly}
        aria-label={done ? `«${t.title}» wieder öffnen` : `«${t.title}» erledigt`}
        aria-pressed={done}
        className="flex h-12 w-12 shrink-0 items-center justify-center disabled:cursor-default"
      >
        <span
          key={done ? 'done' : 'open'}
          className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 transition-colors duration-150 ${
            done ? 'anim-pop border-cat bg-cat text-white' : `${RING[t.priority]} group-hover:border-cat`
          }`}
        >
          {done && <Icon name="check" size={15} />}
        </span>
      </button>
    </div>
  )
}
