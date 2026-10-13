import { useState } from 'react'
import { CategoryChips } from '../labels'
import type { FormEvent } from 'react'
import { addDays } from '../../domain/dateUtils'
import { toDateInput } from '../../domain/entries'
import type { Exam } from '../../domain/exams'
import { STATUS_LABEL, validateTask } from '../../domain/tasks'
import type { TaskErrors, TaskInput, TaskStatus } from '../../domain/tasks'
import { PRIORITY_LABEL } from '../../domain/types'
import type { Priority } from '../../domain/types'
import Icon from '../icons'
import { Segmented } from '../kit'

interface Props {
  initial: TaskInput
  editing: boolean
  exams: Exam[]
  now: Date
  onSave: (t: TaskInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  /** Aus der Aufgabe einen Kalendereintrag machen. */
  onPlan?: (t: TaskInput) => void
}

const PRIOS: Priority[] = ['low', 'medium', 'high', 'urgent']
const ESTIMATES = [15, 30, 60, 90, 120, 180]

export default function TaskForm({ initial, editing, exams, now, onSave, onCancel, onDelete, onPlan }: Props) {
  const [v, setV] = useState<TaskInput>(initial)
  const [errors, setErrors] = useState<TaskErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof TaskInput>(k: K, value: TaskInput[K]) => setV((p) => ({ ...p, [k]: value }))
  const today = toDateInput(now)
  const upcoming = exams.filter((x) => x.start >= addDays(now, -1) || x.id === v.examId)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try {
      await fn()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.')
      setBusy(false)
    }
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const found = validateTask(v)
    setErrors(found ?? {})
    if (!found) void run(() => onSave(v))
  }

  const err = (k: keyof TaskErrors) => (errors[k] ? <p className="mt-1 text-xs text-danger" role="alert">{errors[k]}</p> : null)
  const quickDue = (n: number | null) => setV((p) => ({ ...p, dueDate: n === null ? null : toDateInput(addDays(now, n)), dueTime: n === null ? null : p.dueTime }))

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="t-title">Aufgabe</label>
        <input id="t-title" data-autofocus className="field text-base" value={v.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Was ist zu tun?" aria-invalid={!!errors.title} />
        {err('title')}
      </div>

      <div>
        <span className="label">Fällig</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[
            { n: 0, l: 'Heute' },
            { n: 1, l: 'Morgen' },
            { n: 7, l: 'In einer Woche' },
            { n: null, l: 'Ohne Datum' },
          ].map((q) => {
            const on = q.n === null ? !v.dueDate : v.dueDate === toDateInput(addDays(now, q.n))
            return (
              <button key={q.l} type="button" onClick={() => quickDue(q.n)} aria-pressed={on} className={`min-h-9 rounded border px-3 text-xs transition-colors ${on ? 'border-accent bg-accent/10 font-medium' : 'border-line text-muted hover:text-ink'}`}>
                {q.l}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input aria-label="Fälligkeitsdatum" type="date" className="field tnum" value={v.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} aria-invalid={!!errors.dueDate} />
            {err('dueDate')}
          </div>
          <div>
            <input aria-label="Uhrzeit (optional)" type="time" className="field tnum" value={v.dueTime ?? ''} disabled={!v.dueDate} onChange={(e) => set('dueTime', e.target.value || null)} aria-invalid={!!errors.dueTime} />
            {err('dueTime')}
          </div>
        </div>
        {v.dueDate && v.dueDate < today && v.status !== 'done' && <p className="mt-1 text-xs text-danger">Liegt in der Vergangenheit.</p>}
        {v.dueDate && (
          <div className="mt-3">
            <label className="label" htmlFor="t-rem">Erinnerung</label>
            <select id="t-rem" className="field" value={v.reminderMinutes ?? ''} onChange={(e) => set('reminderMinutes', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Keine</option>
              <option value="0">{v.dueTime ? 'Zur Fälligkeit' : 'Am Fälligkeitstag, 08:00'}</option>
              <option value="60">1 h vorher</option>
              <option value="1440">1 Tag vorher</option>
            </select>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="label">Priorität</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRIOS.map((p) => (
            <button key={p} type="button" onClick={() => set('priority', p)} aria-pressed={v.priority === p} className={`min-h-9 rounded border px-3 text-xs transition-colors ${v.priority === p ? 'border-accent bg-accent/10 font-medium' : 'border-line text-muted hover:text-ink'}`}>
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </fieldset>

      {editing && (
        <div>
          <span className="label">Status</span>
          <Segmented<TaskStatus>
            label="Status"
            size="sm"
            value={v.status}
            onChange={(s) => set('status', s)}
            options={(['open', 'in_progress', 'done'] as TaskStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-exam">Prüfung</label>
          <select id="t-exam" className="field" value={v.examId ?? ''} onChange={(e) => set('examId', e.target.value || null)}>
            <option value="">Keine</option>
            {upcoming.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
                {x.subject && x.subject !== x.title ? ` · ${x.subject}` : ''} ({x.start.toLocaleDateString('de-CH')})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-est">Zeitaufwand</label>
          <select id="t-est" className="field" value={v.estimateMinutes ?? ''} onChange={(e) => set('estimateMinutes', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Unbekannt</option>
            {[...new Set([...ESTIMATES, ...(v.estimateMinutes ? [v.estimateMinutes] : [])])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>
            ))}
          </select>
          {err('estimateMinutes')}
        </div>
      </div>

      <CategoryChips category={v.category} labelId={v.labelId} onChange={(c, l) => setV((p) => ({ ...p, category: c, labelId: l }))} small />

      <div>
        <label className="label" htmlFor="t-desc">Beschreibung und Notizen</label>
        <textarea id="t-desc" rows={3} className="field py-2 leading-relaxed" value={v.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} placeholder="Details, Links, Teilschritte …" />
        {err('description')}
      </div>

      {failure && (
        <p className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {failure}
        </p>
      )}

      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <p className="mr-auto text-sm">Aufgabe endgültig löschen?</p>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>Behalten</button>
          <button type="button" className="btn bg-danger text-white hover:bg-danger/90" disabled={busy} onClick={() => onDelete && void run(onDelete)}>
            {busy ? 'Löscht …' : 'Löschen'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {editing && onDelete && (
            <button type="button" className="btn-ghost text-danger" onClick={() => setConfirm(true)} disabled={busy} aria-label="Aufgabe löschen">
              <Icon name="trash" size={16} />
            </button>
          )}
          {onPlan && v.title.trim() && (
            <button type="button" className="btn-outline" onClick={() => onPlan(v)} disabled={busy} title="Als Termin in den Kalender eintragen">
              <Icon name="calendar" size={16} /> Einplanen
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Speichert …' : editing ? 'Speichern' : 'Aufgabe anlegen'}</button>
        </div>
      )}
    </form>
  )
}
