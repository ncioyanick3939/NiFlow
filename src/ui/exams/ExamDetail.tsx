import { useState } from 'react'
import { formatDateLong, formatTime, formatWeekday } from '../../domain/dateUtils'
import { PREP_LABEL, daysUntil, examToInput, suggestStudyTasks } from '../../domain/exams'
import type { Exam, PrepStatus } from '../../domain/exams'
import { emptyTask, sortTasks } from '../../domain/tasks'
import type { Task, TaskInput } from '../../domain/tasks'
import type { CalendarEvent } from '../../domain/types'
import type { ExamInput } from '../../domain/exams'
import Icon from '../icons'
import { EventRow, Segmented } from '../kit'
import TaskRow from '../tasks/TaskRow'

interface Props {
  exam: Exam
  tasks: Task[]
  sessions: CalendarEvent[]
  now: Date
  readOnly: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
  onUpdate: (v: ExamInput) => Promise<void>
  onAddTask: (defaults: Partial<TaskInput>) => void
  onAddTasks: (list: TaskInput[]) => Promise<void>
  onPlanSession: () => void
  onToggleTask: (t: Task) => void
  onOpenTask: (t: Task) => void
  onOpenEvent: (e: CalendarEvent) => void
}

export function countdownLabel(days: number): string {
  if (days < 0) return 'Vorbei'
  if (days === 0) return 'Heute'
  if (days === 1) return 'Morgen'
  return `In ${days} Tagen`
}

export default function ExamDetail(p: Props) {
  const x = p.exam
  const days = daysUntil(x, p.now)
  const own = sortTasks(p.tasks, 'due')
  const open = own.filter((t) => t.status !== 'done')
  const done = own.length - open.length
  const [plan, setPlan] = useState<{ title: string; dueDate: string; estimateMinutes: number; on: boolean }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try {
      await fn()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const proposal = suggestStudyTasks(x, p.now)
  const topics = x.topics.split('\n').map((t) => t.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className={`flex w-20 shrink-0 flex-col items-center justify-center rounded-lg py-3 ${days >= 0 && days <= 3 ? 'bg-danger/10 text-danger' : days <= 7 && days >= 0 ? 'bg-[rgb(var(--private)/0.12)]' : 'bg-surface2'}`}>
          <span className="tnum text-2xl font-semibold leading-none">{days < 0 ? '–' : days}</span>
          <span className="mt-1 text-[11px] font-medium">{days === 1 ? 'Tag' : days < 0 ? 'vorbei' : 'Tage'}</span>
        </div>
        <div className="min-w-0">
          <p className="eyebrow">{x.subject || 'Prüfung'}</p>
          <h3 className="mt-0.5 break-words text-xl font-semibold leading-snug">{x.title}</h3>
          <p className="tnum mt-1 text-sm text-muted">
            <span className="capitalize">{formatWeekday(x.start)}</span>, {formatDateLong(x.start)} · {formatTime(x.start)}
            {x.end ? `–${formatTime(x.end)}` : ''}
          </p>
          {(x.location || x.format) && <p className="mt-0.5 text-sm text-muted">{[x.location, x.format].filter(Boolean).join(' · ')}</p>}
        </div>
      </div>

      <div>
        <span className="label">Vorbereitung</span>
        <Segmented<PrepStatus>
          label="Vorbereitung"
          size="sm"
          value={x.prepStatus}
          onChange={(s) => !p.readOnly && void run(() => p.onUpdate({ ...examToInput(x), prepStatus: s }))}
          options={(['not_started', 'in_progress', 'ready'] as PrepStatus[]).map((s) => ({ value: s, label: PREP_LABEL[s] }))}
        />
      </div>

      {topics.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold">Lernstoff</h4>
          <ul className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <li key={t} className="rounded-full bg-surface2 px-3 py-1 text-xs">{t}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h4 className="text-sm font-semibold">Lernaufgaben</h4>
          {own.length > 0 && <span className="tnum text-xs text-muted">{done} von {own.length} erledigt</span>}
        </div>
        {own.length > 0 && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / own.length) * 100}%` }} />
          </div>
        )}
        {own.map((t) => (
          <TaskRow key={t.id} task={t} now={p.now} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
        ))}
        {own.length === 0 && !plan && <p className="py-2 text-sm text-muted">Noch keine Lernaufgaben.</p>}

        {plan && (
          <div className="mt-2 rounded-lg border border-accent/30 bg-accent/[0.05] p-3">
            <p className="mb-2 text-sm font-medium">Vorschlag: Diese Lernaufgaben anlegen?</p>
            <p className="mb-2 text-xs text-muted">Abwählen, was du nicht willst. Daten und Aufwand kannst du danach bei jeder Aufgabe ändern.</p>
            <ul className="space-y-1">
              {plan.map((s, i) => (
                <li key={s.title}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={s.on} onChange={() => setPlan(plan.map((q, j) => (j === i ? { ...q, on: !q.on } : q)))} />
                    <span className="flex-1">{s.title}</span>
                    <span className="tnum text-xs text-muted">{new Date(s.dueDate + 'T12:00').toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn-ghost min-h-9" onClick={() => setPlan(null)} disabled={busy}>Verwerfen</button>
              <button
                type="button"
                className="btn-primary min-h-9"
                disabled={busy || !plan.some((s) => s.on)}
                onClick={() =>
                  void run(async () => {
                    await p.onAddTasks(plan.filter((s) => s.on).map((s) => emptyTask({ title: s.title, dueDate: s.dueDate, estimateMinutes: s.estimateMinutes, examId: x.id, category: 'study', priority: x.priority === 'urgent' ? 'high' : 'medium' })))
                    setPlan(null)
                  })
                }
              >
                {busy ? 'Legt an …' : `${plan.filter((s) => s.on).length} anlegen`}
              </button>
            </div>
          </div>
        )}

        {!p.readOnly && !plan && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-outline min-h-9 text-xs" onClick={() => p.onAddTask({ examId: x.id, category: 'study' })}>
              <Icon name="plus" size={14} /> Lernaufgabe
            </button>
            {proposal.length > 0 && (
              <button type="button" className="btn-ghost min-h-9 text-xs text-accent" onClick={() => setPlan(proposal.map((s) => ({ ...s, on: true })))}>
                Lernplan vorschlagen
              </button>
            )}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold">Lerntermine</h4>
        {p.sessions.length === 0 ? (
          <p className="py-1 text-sm text-muted">Noch keine Lerntermine im Kalender.</p>
        ) : (
          p.sessions.map((e) => <EventRow key={e.id} e={e} onOpen={p.onOpenEvent} showDay />)
        )}
        {!p.readOnly && days >= 0 && (
          <button type="button" className="btn-outline mt-2 min-h-9 text-xs" onClick={p.onPlanSession}>
            <Icon name="calendar" size={14} /> Lerntermin planen
          </button>
        )}
      </section>

      {(x.description || x.notes) && (
        <section className="space-y-3">
          {x.description && <p className="whitespace-pre-wrap text-sm">{x.description}</p>}
          {x.notes && <div className="whitespace-pre-wrap rounded-md bg-surface2 px-4 py-3 text-sm">{x.notes}</div>}
        </section>
      )}

      {failure && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{failure}</p>}

      {!p.readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {confirm ? (
            <>
              <p className="mr-auto text-sm">Prüfung löschen? Lernaufgaben und Termine bleiben erhalten, nur die Verknüpfung entfällt.</p>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>Behalten</button>
              <button type="button" className="btn bg-danger text-white hover:bg-danger/90" disabled={busy} onClick={() => void run(p.onDelete)}>Löschen</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={p.onEdit}><Icon name="pencil" size={16} /> Bearbeiten</button>
              <button type="button" className="btn-ghost ml-auto text-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /> Löschen</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
