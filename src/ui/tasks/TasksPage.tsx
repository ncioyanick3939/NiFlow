import { useState } from 'react'
import type { FormEvent } from 'react'
import { toDateInput } from '../../domain/entries'
import type { Exam } from '../../domain/exams'
import { VIEW_LABEL, emptyTask, inView, sortTasks } from '../../domain/tasks'
import type { Task, TaskInput, TaskSort, TaskView } from '../../domain/tasks'
import { PRIORITY_LABEL } from '../../domain/types'
import type { Category, Priority } from '../../domain/types'
import { useStoredState } from '../hooks'
import Icon from '../icons'
import { CATEGORIES, CATEGORY_LABEL, EmptyState } from '../kit'
import TaskRow from './TaskRow'

interface Props {
  tasks: Task[]
  exams: Exam[]
  now: Date
  loading: boolean
  error: string | null
  readOnly: boolean
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  onCreate: (defaults?: Partial<TaskInput>) => void
  onQuickAdd: (t: TaskInput) => Promise<void>
}

const VIEWS: TaskView[] = ['today', 'next', 'week', 'overdue', 'all', 'done']
const SORTS: readonly TaskSort[] = ['due', 'priority', 'category']

export default function TasksPage({ tasks, exams, now, loading, error, readOnly, onToggle, onOpen, onCreate, onQuickAdd }: Props) {
  const [view, setView] = useStoredState<TaskView>('niflow-task-view', 'today', VIEWS)
  const [sort, setSort] = useStoredState<TaskSort>('niflow-task-sort', 'due', SORTS)
  const [cat, setCat] = useState<Category | ''>('')
  const [prio, setPrio] = useState<Priority | ''>('')
  const [quick, setQuick] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickErr, setQuickErr] = useState<string | null>(null)
  const examById = new Map(exams.map((x) => [x.id, x]))

  const count = (v: TaskView) => tasks.filter((t) => inView(t, v, now)).length
  const list = sortTasks(
    tasks.filter((t) => inView(t, view, now) && (!cat || t.category === cat) && (!prio || t.priority === prio)),
    view === 'done' ? 'due' : sort,
  )
  const overdueCount = count('overdue')

  const quickAdd = async (ev: FormEvent) => {
    ev.preventDefault()
    const title = quick.trim()
    if (!title) return
    setQuickBusy(true)
    setQuickErr(null)
    try {
      // In "Heute" fällig heute, sonst ohne Datum
      await onQuickAdd(emptyTask({ title, dueDate: view === 'today' ? toDateInput(now) : null, category: cat || 'study', priority: prio || 'medium' }))
      setQuick('')
    } catch (err) {
      setQuickErr(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setQuickBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-[1.75rem] font-semibold leading-tight tracking-tight">Aufgaben</h1>
        {!readOnly && (
          <button type="button" className="btn-primary hidden md:inline-flex" onClick={() => onCreate(view === 'today' ? { dueDate: toDateInput(now) } : {})}>
            <Icon name="plus" size={16} /> Neue Aufgabe
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-sm" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" /> {error}
        </p>
      )}

      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" aria-label="Ansicht" className="flex gap-1">
          {VIEWS.map((v) => {
            const n = count(v)
            const on = v === view
            return (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setView(v)}
                className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors ${on ? 'bg-ink text-canvas' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
              >
                {VIEW_LABEL[v]}
                {v !== 'done' && v !== 'all' && n > 0 && (
                  <span className={`tnum rounded-full px-1.5 text-[11px] font-semibold ${v === 'overdue' ? 'bg-danger text-white' : on ? 'bg-canvas/20' : 'bg-surface2'}`}>{n}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="t-sort">Sortieren</label>
        <select id="t-sort" className="field min-h-9 w-auto py-0 text-xs" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} disabled={view === 'done'}>
          <option value="due">Nach Fälligkeit</option>
          <option value="priority">Nach Priorität</option>
          <option value="category">Nach Kategorie</option>
        </select>
        <label className="sr-only" htmlFor="t-cat">Kategorie</label>
        <select id="t-cat" className="field min-h-9 w-auto py-0 text-xs" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <label className="sr-only" htmlFor="t-prio">Priorität</label>
        <select id="t-prio" className="field min-h-9 w-auto py-0 text-xs" value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
          <option value="">Alle Prioritäten</option>
          {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        {(cat || prio) && (
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => { setCat(''); setPrio('') }}>
            Filter zurücksetzen
          </button>
        )}
      </div>

      {!readOnly && view !== 'done' && (
        <form onSubmit={quickAdd} className="mb-2 flex items-center gap-1 rounded-md border border-dashed border-line px-1 focus-within:border-accent">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"><Icon name="plus" size={18} /></span>
          <label htmlFor="t-quick" className="sr-only">Neue Aufgabe</label>
          <input
            id="t-quick"
            className="min-h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={view === 'today' ? 'Aufgabe für heute hinzufügen …' : 'Aufgabe hinzufügen …'}
            value={quick}
            maxLength={200}
            onChange={(e) => setQuick(e.target.value)}
            disabled={quickBusy}
          />
          {quick.trim() && <button type="submit" className="btn-primary min-h-9 px-3 text-xs" disabled={quickBusy}>{quickBusy ? '…' : 'Hinzufügen'}</button>}
        </form>
      )}
      {quickErr && <p className="mb-2 text-xs text-danger" role="alert">{quickErr}</p>}

      {view === 'today' && overdueCount > 0 && (
        <button type="button" onClick={() => setView('overdue')} className="mb-2 flex w-full items-center gap-2 rounded-md bg-danger/[0.06] px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10">
          <Icon name="alert" size={15} /> {overdueCount} überfällige Aufgabe{overdueCount > 1 ? 'n' : ''} ansehen
        </button>
      )}

      {loading && tasks.length === 0 ? (
        <p className="py-8 text-sm text-muted">Lädt Aufgaben …</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={view === 'done' ? 'checkCircle' : 'tasks'}
          title={
            view === 'today' ? 'Für heute ist nichts offen' : view === 'overdue' ? 'Nichts überfällig' : view === 'done' ? 'Noch nichts erledigt' : 'Keine Aufgaben in dieser Ansicht'
          }
          text={
            cat || prio
              ? 'Mit den gewählten Filtern gibt es hier nichts. Setze die Filter zurück, um mehr zu sehen.'
              : view === 'today'
                ? 'Füge oben eine Aufgabe hinzu oder schau unter «Als Nächstes», was ansteht.'
                : view === 'done'
                  ? 'Abgehakte Aufgaben bleiben hier auffindbar.'
                  : 'Neue Aufgaben legst du oben im Eingabefeld oder mit «Neue Aufgabe» an.'
          }
        />
      ) : (
        <div className="divide-y divide-line/70">
          {list.map((t) => (
            <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={readOnly} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}
