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
import type { IconName } from '../icons'
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
const VIEW_ICON: Record<TaskView, IconName> = {
  today: 'sun',
  next: 'arrowRight',
  week: 'calendar',
  overdue: 'alert',
  all: 'tasks',
  done: 'checkCircle',
}

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
            ? `flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors ${on ? 'bg-deep text-deepink' : 'bg-surface text-muted'}`
            : `flex min-h-11 w-full items-center gap-3 rounded-full px-3.5 text-left text-[15px] transition-colors ${
                on ? 'bg-deep font-semibold text-deepink' : 'text-muted hover:bg-surface hover:text-ink'
              }`
        }
      >
        {!compact && <Icon name={VIEW_ICON[v]} size={17} className={v === 'overdue' && n > 0 && !on ? 'text-danger' : ''} />}
        <span className={compact ? '' : 'mr-auto'}>{VIEW_LABEL[v]}</span>
        {v !== 'done' && v !== 'all' && n > 0 && (
          <span className={`tnum rounded-full px-1.5 text-xs font-semibold leading-5 ${v === 'overdue' ? 'bg-danger text-white' : on ? 'bg-sun text-sunink' : 'bg-surface2 text-ink'}`}>{n}</span>
        )}
      </button>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)] lg:gap-10">
        {/* Ansichten */}
        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <h1 className="h-display mb-4 text-[28px] leading-tight md:text-[34px]">Aufgaben</h1>
          <div role="tablist" aria-label="Ansicht" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 lg:hidden">
            {VIEWS.map((v) => viewButton(v, true))}
          </div>
          <div role="tablist" aria-label="Ansicht" className="hidden space-y-1 lg:block">
            {VIEWS.map((v) => viewButton(v, false))}
          </div>
          <div className="mt-6 hidden lg:block">
            <p className="eyebrow mb-2 px-3.5">Kategorie</p>
            <div className="space-y-0.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(cat === c ? '' : c)}
                  className={`${catClass(c)} flex min-h-9 w-full items-center gap-3 rounded-full px-3.5 text-left text-sm transition-colors ${cat === c ? 'bg-cat/15 font-semibold' : 'text-muted hover:bg-surface hover:text-ink'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-cat" aria-hidden="true" />
                  {CATEGORY_LABEL[c]}
                  <span className="tnum ml-auto text-xs">{tasks.filter((t) => t.category === c && t.status !== 'done').length || ''}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Liste */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="h-section mr-auto">
              {VIEW_LABEL[view]} <span className="tnum font-sans text-base font-normal text-muted">{list.length}</span>
            </h2>
            <label className="sr-only" htmlFor="t-sort">Sortieren</label>
            <select id="t-sort" className="field min-h-9 w-auto rounded-full py-0 text-xs" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} disabled={view === 'done'}>
              <option value="due">Nach Fälligkeit</option>
              <option value="priority">Nach Priorität</option>
              <option value="category">Nach Kategorie</option>
            </select>
            <label className="sr-only" htmlFor="t-cat">Kategorie</label>
            <select id="t-cat" className="field min-h-9 w-auto rounded-full py-0 text-xs lg:hidden" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
              <option value="">Alle Kategorien</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <label className="sr-only" htmlFor="t-prio">Priorität</label>
            <select id="t-prio" className="field min-h-9 w-auto rounded-full py-0 text-xs" value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
              <option value="">Alle Prioritäten</option>
              {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
            {!readOnly && (
              <button type="button" className="btn-primary min-h-9" onClick={() => onCreate(view === 'today' ? { dueDate: toDateInput(now) } : {})}>
                <Icon name="plus" size={16} /> Neue Aufgabe
              </button>
            )}
          </div>

          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-danger/[0.08] px-4 py-3 text-sm" role="alert">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" /> {error}
            </p>
          )}

          {(cat || prio) && (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              Gefiltert:
              {cat && <span className={`${catClass(cat)} chip bg-cat/15 text-ink`}>{CATEGORY_LABEL[cat]}</span>}
              {prio && <span className="chip bg-surface2 text-ink">{PRIORITY_LABEL[prio]}</span>}
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => { setCat(''); setPrio('') }}>
                Zurücksetzen
              </button>
            </p>
          )}

          <div className="rounded-xl bg-surface p-2 md:p-3">
            {!readOnly && view !== 'done' && (
              <form onSubmit={quickAdd} className="mb-1 flex items-center gap-1 rounded-lg px-1 transition-colors focus-within:bg-surface2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-accent"><Icon name="plus" size={19} /></span>
                <label htmlFor="t-quick" className="sr-only">Neue Aufgabe</label>
                <input
                  id="t-quick"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/80 focus-visible:ring-0 focus-visible:ring-offset-0"
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
              <button type="button" onClick={() => setView('overdue')} className="mb-1 flex w-full items-center gap-3 rounded-lg bg-danger/[0.07] px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10">
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
                <div key={g.key} className="mt-1 first:mt-0">
                  {g.label && groups.length > 1 && (
                    <h3 className={`flex items-center gap-2 px-3 pb-1 pt-3 text-[13px] font-semibold ${g.tone === 'danger' ? 'text-danger' : 'text-muted'}`}>
                      {g.label}
                      <span className="tnum font-normal">{g.tasks.length}</span>
                    </h3>
                  )}
                  <div className={`divide-y divide-line/60 ${g.tone === 'muted' && g.key === 'done' ? 'opacity-80' : ''}`}>
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
