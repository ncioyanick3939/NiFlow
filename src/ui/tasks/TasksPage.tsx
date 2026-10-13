import { useState } from 'react'
import type { FormEvent } from 'react'
import { toDateInput } from '../../domain/entries'
import type { Exam } from '../../domain/exams'
import { VIEW_LABEL, emptyTask, groupTasks, inView, sortTasks } from '../../domain/tasks'
import type { Task, TaskInput, TaskSort, TaskView } from '../../domain/tasks'
import { PRIORITY_LABEL } from '../../domain/types'
import type { Category, Priority } from '../../domain/types'
import { useStoredState } from '../hooks'
import Icon from '../icons'
import { CATEGORIES, CATEGORY_LABEL, EmptyState, catClass } from '../kit'
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

/**
 * Aufgaben: links die Ansichten als feste Leiste (am Handy als Chips),
 * rechts Filter, Schnelleingabe und eine nach Fälligkeit gruppierte Liste.
 */
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
  const groups = groupTasks(list, view, view === 'done' ? 'due' : sort, now)
  const overdueCount = count('overdue')

  const quickAdd = async (ev: FormEvent) => {
    ev.preventDefault()
    const title = quick.trim()
    if (!title) return
    setQuickBusy(true)
    setQuickErr(null)
    try {
      await onQuickAdd(emptyTask({ title, dueDate: view === 'today' ? toDateInput(now) : null, category: cat || 'study', priority: prio || 'medium' }))
      setQuick('')
    } catch (err) {
      setQuickErr(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setQuickBusy(false)
    }
  }

  const viewButton = (v: TaskView, compact: boolean) => {
    const n = count(v)
    const on = v === view
    return (
      <button
        key={v}
        role="tab"
        type="button"
        aria-selected={on}
        onClick={() => setView(v)}
        className={
          compact
            ? `relative flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm transition-colors duration-150 ${on ? 'font-semibold text-ink' : 'text-muted'}`
            : `relative flex min-h-11 w-full items-center gap-3 pl-4 pr-1 text-left text-[15px] transition-colors duration-150 ${
                on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
              }`
        }
      >
        <span className={compact ? `absolute inset-x-2 bottom-0 h-[2px] ${on ? 'bg-accent' : ''}` : `absolute inset-y-2 left-0 w-[2px] ${on ? 'bg-accent' : ''}`} aria-hidden="true" />
        <span className={compact ? '' : 'mr-auto'}>{VIEW_LABEL[v]}</span>
        {v !== 'done' && v !== 'all' && n > 0 && (
          <span className={`tnum text-xs ${v === 'overdue' ? 'font-semibold text-danger' : 'text-muted'}`}>{n}</span>
        )}
      </button>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)] lg:gap-10">
        {/* Ansichten */}
        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <h1 className="h-display mb-4 text-[28px] leading-tight md:text-[34px] lg:pl-4">Aufgaben</h1>
          <div role="tablist" aria-label="Ansicht" className="-mx-5 flex overflow-x-auto border-b border-line px-3 lg:hidden">
            {VIEWS.map((v) => viewButton(v, true))}
          </div>
          <div role="tablist" aria-label="Ansicht" className="hidden lg:block">
            {VIEWS.map((v) => viewButton(v, false))}
          </div>
          <div className="mt-6 hidden lg:block">
            <p className="eyebrow mb-1 border-t border-line pl-4 pt-4">Kategorie</p>
            <div className="space-y-0.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(cat === c ? '' : c)}
                  className={`${catClass(c)} flex min-h-11 w-full items-center gap-3 pl-4 pr-1 text-left text-sm transition-colors duration-150 ${cat === c ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
                >
                  <span className="h-2 w-2 bg-cat" aria-hidden="true" />
                  {CATEGORY_LABEL[c]}
                  <span className="tnum ml-auto text-xs">{tasks.filter((t) => t.category === c && t.status !== 'done').length || ''}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Liste */}
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 lg:pt-3">
            <h2 className="h-section mr-auto">
              {VIEW_LABEL[view]} <span className="tnum font-normal text-muted">{list.length}</span>
            </h2>
            <label className="sr-only" htmlFor="t-sort">Sortieren</label>
            <select id="t-sort" className="field min-h-11 w-auto rounded py-0 text-base md:min-h-9 md:text-xs" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} disabled={view === 'done'}>
              <option value="due">Nach Fälligkeit</option>
              <option value="priority">Nach Priorität</option>
              <option value="category">Nach Kategorie</option>
            </select>
            <label className="sr-only" htmlFor="t-cat">Kategorie</label>
            <select id="t-cat" className="field min-h-11 w-auto rounded py-0 text-base md:min-h-9 md:text-xs lg:hidden" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
              <option value="">Alle Kategorien</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <label className="sr-only" htmlFor="t-prio">Priorität</label>
            <select id="t-prio" className="field min-h-11 w-auto rounded py-0 text-base md:min-h-9 md:text-xs" value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
              <option value="">Alle Prioritäten</option>
              {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
            {!readOnly && (
              <button type="button" className="btn-primary min-h-11 md:min-h-9" onClick={() => onCreate(view === 'today' ? { dueDate: toDateInput(now) } : {})}>
                <Icon name="plus" size={16} /> Neue Aufgabe
              </button>
            )}
          </div>

          {error && (
            <p className="mb-4 flex items-start gap-2 border-l-2 border-danger bg-surface px-4 py-3 text-sm" role="alert">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" /> {error}
            </p>
          )}

          {(cat || prio) && (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              Gefiltert:
              {cat && <span className={`${catClass(cat)} chip border border-line text-ink`}><span className="h-2 w-2 bg-cat" aria-hidden="true" />{CATEGORY_LABEL[cat]}</span>}
              {prio && <span className="chip border border-line text-ink">{PRIORITY_LABEL[prio]}</span>}
              <button type="button" className="min-h-11 font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink" onClick={() => { setCat(''); setPrio('') }}>
                Zurücksetzen
              </button>
            </p>
          )}

          <div className="border-t border-line">
            {!readOnly && view !== 'done' && (
              <form onSubmit={quickAdd} className="flex items-center gap-1 border-b border-line transition-colors focus-within:bg-surface">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-accent"><Icon name="plus" size={19} /></span>
                <label htmlFor="t-quick" className="sr-only">Neue Aufgabe</label>
                <input
                  id="t-quick"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm placeholder:text-muted/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={view === 'today' ? 'Aufgabe für heute hinzufügen' : 'Aufgabe hinzufügen'}
                  value={quick}
                  maxLength={200}
                  onChange={(e) => setQuick(e.target.value)}
                  disabled={quickBusy}
                />
                {quick.trim() && <button type="submit" className="btn-primary min-h-9 px-3 text-xs" disabled={quickBusy}>{quickBusy ? 'Speichert …' : 'Hinzufügen'}</button>}
              </form>
            )}
            {quickErr && <p className="mb-2 px-3 text-xs text-danger" role="alert">{quickErr}</p>}

            {view === 'today' && overdueCount > 0 && (
              <button type="button" onClick={() => setView('overdue')} className="flex min-h-11 w-full items-center gap-3 border-b border-line px-3 text-left text-sm font-medium text-danger transition-colors hover:bg-surface2/60">
                <Icon name="alert" size={16} /> {overdueCount} überfällige Aufgabe{overdueCount > 1 ? 'n' : ''} ansehen
              </button>
            )}

            {loading && tasks.length === 0 ? (
              <p className="px-3 py-8 text-sm text-muted">Lädt Aufgaben …</p>
            ) : groups.length === 0 ? (
              <EmptyState
                icon={view === 'done' ? 'checkCircle' : 'tasks'}
                title={view === 'today' ? 'Für heute ist nichts offen' : view === 'overdue' ? 'Nichts überfällig' : view === 'done' ? 'Noch nichts erledigt' : 'Keine Aufgaben in dieser Ansicht'}
                text={
                  cat || prio
                    ? 'Mit diesen Filtern gibt es hier nichts. Setze die Filter zurück, um mehr zu sehen.'
                    : view === 'today'
                      ? 'Füge oben eine Aufgabe hinzu oder schau unter «Als Nächstes», was ansteht.'
                      : view === 'done'
                        ? 'Abgehakte Aufgaben bleiben hier auffindbar.'
                        : 'Neue Aufgaben legst du oben im Eingabefeld an.'
                }
              />
            ) : (
              groups.map((g) => (
                <div key={g.key}>
                  {g.label && groups.length > 1 && (
                    <h3 className={`flex items-center gap-2 border-b border-line pb-1.5 pt-5 text-[13px] font-semibold ${g.tone === 'danger' ? 'text-danger' : 'text-muted'}`}>
                      {g.label}
                      <span className="tnum font-normal">{g.tasks.length}</span>
                    </h3>
                  )}
                  <div className={`divide-y divide-line ${g.tone === 'muted' && g.key === 'done' ? 'opacity-80' : ''}`}>
                    {g.tasks.map((t) => (
                      <TaskRow key={t.id} task={t} now={now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={readOnly} onToggle={onToggle} onOpen={onOpen} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
