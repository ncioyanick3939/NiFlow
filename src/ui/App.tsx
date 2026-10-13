import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEntry, deleteEntry, skipOccurrence, updateEntry } from '../data/entries'
import { callPush } from '../data/googlePush'
import type { PushStatus } from '../data/googlePush'
import { createExam, createTask, createTasks, deleteExam, deleteTask, updateExam, updateTask } from '../data/planner'
import { addDays, formatTime, startOfDay } from '../domain/dateUtils'
import { emptyInput, eventToInput, toDateInput, toTimeInput } from '../domain/entries'
import type { EntryInput } from '../domain/entries'
import { emptyExam, examToEvent, examToInput } from '../domain/exams'
import type { ExamInput } from '../domain/exams'
import { emptyTask, isOverdue, taskToEvent, taskToInput } from '../domain/tasks'
import type { Task, TaskInput } from '../domain/tasks'
import type { CalendarEvent } from '../domain/types'
import { connectGoogle, disconnectGoogle } from '../lib/supabase'
import CalendarPage from './calendar/CalendarPage'
import Dashboard from './Dashboard'
import EntryForm from './EntryForm'
import EventDetail from './EventDetail'
import ExamDetail from './exams/ExamDetail'
import ExamForm from './exams/ExamForm'
import ExamsPage from './exams/ExamsPage'
import { useAuth, useEvents, useNow, usePlanner } from './hooks'
import Icon from './icons'
import type { IconName } from './icons'
import { Segmented, Sheet } from './kit'
import { BottomBar, SECTIONS, Sidebar } from './Nav'
import type { Section } from './Nav'
import SettingsView from './SettingsView'
import TaskForm from './tasks/TaskForm'
import TasksPage from './tasks/TasksPage'
import { useTheme } from './theme'
import TrainingPage from './TrainingPage'
import Welcome from './Welcome'
import { useReminders } from './reminders'

type SheetState =
  | { kind: 'detail'; event: CalendarEvent }
  | { kind: 'form'; input: EntryInput; editId?: string }
  | { kind: 'task'; input: TaskInput; task?: Task }
  | { kind: 'exam'; examId: string }
  | { kind: 'examForm'; input: ExamInput; editId?: string }
  | { kind: 'create' }
  | { kind: 'more' }
  | null

function sectionFromHash(): Section {
  const h = window.location.hash.replace(/^#\/?/, '')
  return SECTIONS.find((s) => s.hash === h)?.id ?? 'dashboard'
}

export default function App() {
  const now = useNow()
  const theme = useTheme()
  const { session, ready, connected } = useAuth()
  const [demo, setDemo] = useState(false)
  const mode = connected ? 'live' : demo ? 'demo' : 'off'
  const { events: sourceEvents, states, loading, reload } = useEvents(mode, ready)
  const planner = usePlanner(mode, ready)
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [calendarJump, setCalendarJump] = useState<{ date: Date; n: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const readOnly = !connected
  const [push, setPush] = useState<PushStatus | null>(null)

  // Aufgaben mit Datum und Prüfungen erscheinen im Kalender: eine Datenquelle, immer konsistent.
  const events = useMemo(
    () => [
      ...sourceEvents,
      ...planner.tasks.map(taskToEvent).filter((e): e is CalendarEvent => e !== null),
      ...planner.exams.map(examToEvent),
    ],
    [sourceEvents, planner.tasks, planner.exams],
  )
  const examById = useMemo(() => new Map(planner.exams.map((x) => [x.id, x])), [planner.exams])
  const overdueCount = planner.tasks.filter((t) => isOverdue(t, now)).length

  // Status des Google-Abgleichs laden (nur angemeldet). Fehler hier sind nicht kritisch.
  useEffect(() => {
    if (!connected) {
      setPush(null)
      return
    }
    callPush<PushStatus>({ action: 'status' })
      .then(setPush)
      .catch(() => setPush(null))
  }, [connected])

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  useReminders(events, planner.tasks, connected, (r) => showToast(`${r.title} · ${r.body}`))

  /** Nach einer Änderung an eigenen Terminen: in Google nachführen, wenn der Abgleich aktiv ist. */
  const pushToGoogle = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!push?.enabled) return
      try {
        await callPush(payload)
      } catch (err) {
        showToast(`Gespeichert, aber nicht zu Google übertragen: ${err instanceof Error ? err.message : ''}`)
      }
    },
    [push, showToast],
  )

  const navigate = useCallback((s: Section) => {
    setSection(s)
    setSheet(null)
    const hash = SECTIONS.find((x) => x.id === s)!.hash
    if (window.location.hash !== `#/${hash}`) window.history.pushState(null, '', `#/${hash}`)
    window.scrollTo({ top: 0 })
  }, [])

  const close = useCallback(() => setSheet(null), [])

  const openTask = useCallback((t: Task) => setSheet({ kind: 'task', input: taskToInput(t), task: t }), [])
  const openEvent = useCallback(
    (e: CalendarEvent) => {
      if (e.ref?.type === 'task') {
        const t = planner.tasks.find((x) => x.id === e.ref!.id)
        if (t) return openTask(t)
      }
      if (e.ref?.type === 'exam') return setSheet({ kind: 'exam', examId: e.ref.id })
      setSheet({ kind: 'detail', event: e })
    },
    [planner.tasks, openTask],
  )

  const create = useCallback(
    (date: Date, time?: Date, extra: Partial<EntryInput> = {}) => {
      const input = { ...emptyInput('event', date, now), ...extra }
      if (time) {
        input.startTime = toTimeInput(time)
        const end = new Date(time.getTime() + 60 * 60000)
        input.endTime = end.getDate() === time.getDate() ? toTimeInput(end) : '23:59'
      }
      setSheet({ kind: 'form', input })
    },
    [now],
  )
  const createNote = useCallback((date: Date, title = '') => setSheet({ kind: 'form', input: { ...emptyInput('note', date), title } }), [])
  const createTaskSheet = useCallback((defaults: Partial<TaskInput> = {}) => setSheet({ kind: 'task', input: emptyTask(defaults) }), [])
  const createExamSheet = useCallback(() => setSheet({ kind: 'examForm', input: emptyExam(addDays(now, 14)) }), [now])

  // Eigene Einträge
  const saveEntry = async (input: EntryInput, editId?: string) => {
    let id = editId
    if (editId) await updateEntry(editId, input)
    else id = await createEntry(input)
    setSheet(null)
    if (input.type === 'event' && id) await pushToGoogle({ action: 'upsert', entry_id: id })
    await reload(['own'])
  }
  const moveEntry = async (e: CalendarEvent, input: EntryInput) => {
    await updateEntry(e.externalId, input)
    setSheet(null)
    if (e.kind !== 'note') await pushToGoogle({ action: 'upsert', entry_id: e.externalId })
    await reload(['own'])
  }
  const removeEntry = async (e: CalendarEvent) => {
    await deleteEntry(e.externalId)
    setSheet(null)
    if (e.googleEventId) await pushToGoogle({ action: 'delete', google_event_id: e.googleEventId })
    await reload(['own'])
  }
  const skipEntry = async (e: CalendarEvent) => {
    await skipOccurrence(e.externalId, e.exdates ?? [], e.ref?.occurrence ?? toDateInput(e.start))
    setSheet(null)
    await pushToGoogle({ action: 'upsert', entry_id: e.externalId })
    await reload(['own'])
  }
  const quickNote = async (title: string) => {
    await createEntry({ ...emptyInput('note', now), title })
    await reload(['own'])
  }

  // Aufgaben
  const toggleTask = useCallback(
    (t: Task) => {
      if (readOnly) return
      const next = t.status === 'done' ? 'open' : 'done'
      planner.patchTask(t.id, { status: next, completedAt: next === 'done' ? new Date() : null })
      updateTask(t.id, { ...taskToInput(t), status: next }, t.status)
        .then(() => planner.reload())
        .catch((err: unknown) => {
          planner.patchTask(t.id, { status: t.status, completedAt: t.completedAt })
          showToast(err instanceof Error ? err.message : 'Ändern fehlgeschlagen.')
        })
    },
    [readOnly, planner, showToast],
  )
  const saveTask = async (input: TaskInput, task?: Task) => {
    if (task) await updateTask(task.id, input, task.status)
    else await createTask(input)
    setSheet(null)
    await planner.reload()
  }
  const removeTask = async (task: Task) => {
    await deleteTask(task.id)
    setSheet(null)
    await planner.reload()
  }
  const quickTask = async (input: TaskInput) => {
    await createTask(input)
    await planner.reload()
  }
  /** Aus einer Aufgabe einen Kalendertermin machen (Dauer = geschätzter Aufwand). */
  const planTask = (input: TaskInput, task?: Task) => {
    const day = input.dueDate ? new Date(input.dueDate + 'T00:00') : startOfDay(now)
    const base = emptyInput('event', day < startOfDay(now) ? startOfDay(now) : day, now)
    const minutes = input.estimateMinutes ?? 60
    const [h, m] = base.startTime.split(':').map(Number)
    const endMin = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
    setSheet({
      kind: 'form',
      input: {
        ...base,
        title: input.title,
        category: input.category,
        endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        taskId: task?.id ?? null,
        examId: input.examId,
      },
    })
  }

  // Prüfungen
  const saveExam = async (input: ExamInput, editId?: string) => {
    if (editId) {
      await updateExam(editId, input)
      await planner.reload()
      setSheet({ kind: 'exam', examId: editId })
    } else {
      const id = await createExam(input)
      await planner.reload()
      setSheet({ kind: 'exam', examId: id })
    }
  }
  const planSession = (examId: string) => {
    const x = examById.get(examId)
    if (!x) return
    const day = now.getHours() >= 20 ? addDays(startOfDay(now), 1) : startOfDay(now)
    create(day, undefined, { title: `Lernen: ${x.subject || x.title}`, category: 'study', examId: x.id })
  }

  const openDay = (d: Date) => {
    setCalendarJump({ date: d, n: Date.now() })
    navigate('calendar')
  }

  if (!ready) return <div className="min-h-dvh" />
  if (!connected && !demo) return <Welcome onConnect={() => void connectGoogle()} onDemo={() => setDemo(true)} />

  const errors = states.filter((s) => s.status === 'error')
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined
  const firstName = (meta?.full_name ?? meta?.name ?? '').split(' ')[0] || null
  const fab = () => (section === 'tasks' ? createTaskSheet() : section === 'exams' ? createExamSheet() : setSheet({ kind: 'create' }))
  const currentExam = sheet?.kind === 'exam' ? examById.get(sheet.examId) : undefined

  const sheetTitle = (() => {
    switch (sheet?.kind) {
      case 'form':
        return sheet.editId ? (sheet.input.type === 'note' ? 'Notiz bearbeiten' : 'Termin bearbeiten') : sheet.input.type === 'note' ? 'Neue Notiz' : 'Neuer Termin'
      case 'task':
        return sheet.task ? 'Aufgabe' : 'Neue Aufgabe'
      case 'exam':
        return 'Prüfung'
      case 'examForm':
        return sheet.editId ? 'Prüfung bearbeiten' : 'Neue Prüfung'
      case 'create':
        return 'Neu erstellen'
      case 'more':
        return 'Mehr'
      case 'detail':
        return sheet.event.kind === 'note' ? 'Notiz' : 'Details'
      default:
        return ''
    }
  })()

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        active={section}
        onNavigate={navigate}
        onCreate={readOnly ? undefined : () => setSheet({ kind: 'create' })}
        states={states}
        loading={loading || planner.loading}
        onReload={() => {
          void reload()
          void planner.reload()
        }}
        badge={overdueCount}
      />
      <main className="min-w-0 flex-1">
        {demo && !connected && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-accent/10 px-4 py-2.5 text-sm md:px-8">
            <span className="font-semibold text-accent">Demo</span>
            <span className="mr-auto text-muted">Erfundene Beispieldaten. Zum Speichern eigener Einträge anmelden.</span>
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => void connectGoogle()}>
              Anmelden
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={() => setDemo(false)}>
              Beenden
            </button>
          </div>
        )}
        {(errors.length > 0 || planner.error) && (
          <div className="space-y-1 border-b border-danger/20 bg-danger/[0.06] px-4 py-2.5 md:px-8" role="alert">
            {errors.map((s) => (
              <p key={s.id} className="flex flex-wrap items-center gap-x-3 text-sm">
                <Icon name="alert" size={15} className="shrink-0 text-danger" />
                <span className="mr-auto">
                  <span className="font-semibold">{s.label}:</span> {s.error}
                  {s.lastSync && <span className="text-muted"> Zuletzt erfolgreich {formatTime(s.lastSync)} Uhr.</span>}
                </span>
                {s.id === 'google' && (
                  <button type="button" className="font-medium text-accent hover:underline" onClick={() => void connectGoogle()}>
                    Neu verbinden
                  </button>
                )}
              </p>
            ))}
            {planner.error && (
              <p className="flex items-center gap-3 text-sm">
                <Icon name="alert" size={15} className="shrink-0 text-danger" />
                <span>
                  <span className="font-semibold">Aufgaben und Prüfungen:</span> {planner.error}
                </span>
              </p>
            )}
          </div>
        )}

        {section === 'dashboard' && (
          <Dashboard
            events={events}
            now={now}
            loading={loading}
            firstName={firstName}
            readOnly={readOnly}
            onOpen={openEvent}
            onCreate={(d, t) => create(d, t)}
            onCreateNote={(d) => createNote(d)}
            onQuickNote={quickNote}
            onOpenDay={openDay}
            onGoTraining={() => navigate('training')}
            tasks={planner.tasks}
            exams={planner.exams}
            onToggleTask={toggleTask}
            onOpenTask={openTask}
            onOpenExam={(x) => setSheet({ kind: 'exam', examId: x.id })}
            onGoTasks={() => navigate('tasks')}
            onGoExams={() => navigate('exams')}
            onQuickTask={(title) => quickTask(emptyTask({ title, dueDate: toDateInput(now) }))}
          />
        )}
        {section === 'calendar' && (
          <CalendarPage
            key={calendarJump?.n ?? 0}
            initialDate={calendarJump?.date}
            events={events}
            now={now}
            loading={loading}
            readOnly={readOnly}
            onOpen={openEvent}
            onCreate={(d, t) => create(d, t)}
          />
        )}
        {section === 'tasks' && (
          <TasksPage
            tasks={planner.tasks}
            exams={planner.exams}
            now={now}
            loading={planner.loading}
            error={planner.error}
            readOnly={readOnly}
            onToggle={toggleTask}
            onOpen={openTask}
            onCreate={createTaskSheet}
            onQuickAdd={quickTask}
          />
        )}
        {section === 'exams' && (
          <ExamsPage
            exams={planner.exams}
            tasks={planner.tasks}
            sessions={sourceEvents.filter((e) => !!e.examId)}
            now={now}
            loading={planner.loading}
            error={planner.error}
            readOnly={readOnly}
            onOpen={(x) => setSheet({ kind: 'exam', examId: x.id })}
            onCreate={createExamSheet}
          />
        )}
        {section === 'training' && (
          <TrainingPage events={events} states={states} now={now} demo={!connected} onOpen={openEvent} onGoSettings={() => navigate('settings')} />
        )}
        {section === 'settings' && (
          <SettingsView
            email={session?.user.email ?? null}
            demo={demo}
            states={states}
            theme={theme.choice}
            onTheme={theme.set}
            onConnect={() => void connectGoogle()}
            onSignOut={() => {
              setDemo(false)
              void disconnectGoogle()
            }}
            onChanged={() => void reload(['intervals'])}
            push={push}
            onPush={(next) => {
              setPush(next)
              void reload(['own'])
            }}
          />
        )}
      </main>

      <BottomBar active={section} onNavigate={navigate} onMore={() => setSheet({ kind: 'more' })} badge={overdueCount} />

      {!readOnly && section !== 'settings' && section !== 'training' && (
        <button
          type="button"
          onClick={fab}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accentink shadow-sheet transition-transform active:scale-95 md:hidden"
          aria-label={section === 'tasks' ? 'Neue Aufgabe' : section === 'exams' ? 'Neue Prüfung' : 'Neu erstellen'}
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      {toast && (
        <div role="status" className="anim-sheet fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-sm text-canvas shadow-sheet md:bottom-6">
          {toast}
        </div>
      )}

      <Sheet open={sheet !== null} onClose={close} title={sheetTitle}>
        {sheet?.kind === 'detail' && (
          <EventDetail
            event={sheet.event}
            readOnly={readOnly}
            onEdit={(e) => setSheet({ kind: 'form', input: eventToInput(e), editId: e.externalId })}
            onMove={moveEntry}
            onDelete={removeEntry}
            onSkip={skipEntry}
            onAddNote={(date, title) => createNote(date, `Notiz: ${title}`)}
          />
        )}
        {sheet?.kind === 'form' && (
          <EntryForm
            key={sheet.editId ?? 'new'}
            initial={sheet.input}
            editing={!!sheet.editId}
            examName={sheet.input.examId ? examById.get(sheet.input.examId)?.title : undefined}
            onSave={(input) => saveEntry(input, sheet.editId)}
            onCancel={close}
          />
        )}
        {sheet?.kind === 'task' && (
          <TaskForm
            key={sheet.task?.id ?? 'new'}
            initial={sheet.input}
            editing={!!sheet.task}
            exams={planner.exams}
            now={now}
            onSave={(input) => saveTask(input, sheet.task)}
            onCancel={close}
            onDelete={sheet.task ? () => removeTask(sheet.task!) : undefined}
            onPlan={readOnly ? undefined : (input) => planTask(input, sheet.task)}
          />
        )}
        {sheet?.kind === 'exam' && currentExam && (
          <ExamDetail
            exam={currentExam}
            tasks={planner.tasks.filter((t) => t.examId === currentExam.id)}
            sessions={sourceEvents.filter((e) => e.examId === currentExam.id).sort((a, b) => a.start.getTime() - b.start.getTime())}
            now={now}
            readOnly={readOnly}
            onEdit={() => setSheet({ kind: 'examForm', input: examToInput(currentExam), editId: currentExam.id })}
            onDelete={async () => {
              await deleteExam(currentExam.id)
              setSheet(null)
              await planner.reload()
            }}
            onUpdate={async (v) => {
              await updateExam(currentExam.id, v)
              await planner.reload()
            }}
            onAddTask={(d) => createTaskSheet(d)}
            onAddTasks={async (list) => {
              await createTasks(list)
              await planner.reload()
            }}
            onPlanSession={() => planSession(currentExam.id)}
            onToggleTask={toggleTask}
            onOpenTask={openTask}
            onOpenEvent={openEvent}
          />
        )}
        {sheet?.kind === 'exam' && !currentExam && <p className="text-sm text-muted">Diese Prüfung gibt es nicht mehr.</p>}
        {sheet?.kind === 'examForm' && (
          <ExamForm key={sheet.editId ?? 'new'} initial={sheet.input} editing={!!sheet.editId} onSave={(v) => saveExam(v, sheet.editId)} onCancel={close} />
        )}
        {sheet?.kind === 'create' && (
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { icon: 'calendar', label: 'Termin', text: 'Mit Uhrzeit im Kalender', go: () => create(startOfDay(now)) },
                { icon: 'tasks', label: 'Aufgabe', text: 'Mit Fälligkeit und Priorität', go: () => createTaskSheet() },
                { icon: 'note', label: 'Notiz', text: 'An einem Tag, ohne Uhrzeit', go: () => createNote(now) },
                { icon: 'exam', label: 'Prüfung', text: 'Mit Lernaufgaben planen', go: () => createExamSheet() },
              ] as { icon: IconName; label: string; text: string; go: () => void }[]
            ).map((o) => (
              <button key={o.label} type="button" onClick={o.go} className="flex flex-col items-start gap-2 rounded-lg border border-line p-4 text-left transition-colors hover:border-accent hover:bg-accent/[0.04]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon name={o.icon} size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted">{o.text}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {sheet?.kind === 'more' && (
          <div className="space-y-4">
            <div className="space-y-1">
              {SECTIONS.filter((s) => s.id === 'training' || s.id === 'settings').map((s) => (
                <button key={s.id} type="button" onClick={() => navigate(s.id)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left transition-colors hover:bg-surface2">
                  <Icon name={s.icon} size={20} className="text-muted" />
                  <span className="flex-1 font-medium">{s.label}</span>
                  <Icon name="chevronRight" size={16} className="text-muted" />
                </button>
              ))}
            </div>
            <div className="border-t border-line pt-4">
              <span className="label">Farbschema</span>
              <Segmented
                label="Farbschema"
                value={theme.choice}
                onChange={theme.set}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Hell' },
                  { value: 'dark', label: 'Dunkel' },
                ]}
              />
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
