import { formatTime } from '../../domain/dateUtils'
import { PREP_LABEL, daysUntil } from '../../domain/exams'
import type { Exam } from '../../domain/exams'
import type { Task } from '../../domain/tasks'
import Icon from '../icons'

interface Props {
  exam: Exam
  tasks: Task[]
  now: Date
  onOpen: () => void
  /** Kleine Überschrift über dem Titel, z. B. "Nächste Prüfung". */
  label?: string
}

/** Dunkle Prüfungskarte mit Countdown und Lernfortschritt. Überall in der App gleich. */
export default function ExamCard({ exam, tasks, now, onOpen, label = 'Prüfung' }: Props) {
  const days = daysUntil(exam, now)
  const done = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length > 0 ? done / tasks.length : exam.prepStatus === 'ready' ? 1 : 0
  return (
    <button type="button" onClick={onOpen} className="group block w-full overflow-hidden rounded-3xl bg-deep p-5 text-left text-deepink shadow-float transition-transform duration-150 active:scale-[0.99]">
      <span className="flex items-center gap-2 text-[13px] font-bold text-deepmuted">
        <Icon name="exam" size={15} /> {label}
      </span>
      <span className="mt-3 flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block break-words text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{exam.title}</span>
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
  )
}
