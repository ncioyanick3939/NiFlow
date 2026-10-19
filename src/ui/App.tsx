import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LabelsContext, useLabelsData, withLabels } from './labels'
import { createEntry, deleteEntry, skipOccurrence, updateEntry } from '../data/entries'
import { callPush } from '../data/googlePush'
import type { PushStatus } from '../data/googlePush'
import { createExam, createTask, createTasks, deleteExam, deleteTask, updateExam, updateTask } from '../data/planner'
import { describeSummary, quickPrompts, summarizePlan } from '../domain/aiPlan'
import type { Proposal } from '../domain/aiPlan'
import { addDays, formatTime, startOfDay } from '../domain/dateUtils'
import { emptyInput, eventToInput, toDateInput, toTimeInput } from '../domain/entries'
import type { EntryInput } from '../domain/entries'
import { emptyExam, examToEvent, examToInput } from '../domain/exams'
import type { ExamInput } from '../domain/exams'
import { emptyTask, isOverdue, taskToEvent, taskToInput } from '../domain/tasks'
import type { Task, TaskInput } from '../domain/tasks'
import type { CalendarEvent } from '../domain/types'
import { connectGoogle, deleteAccount, disconnectGoogle, hasGoogleIdentity } from '../lib/supabase'
import AssistantPanel from './assistant/AssistantPanel'
import { useAiConsent } from './assistant/useAiConsent'
import { useAssistant } from './assistant/useAssistant'
import { useWeather } from './useWeather'
import TimerPanel from './timer/TimerPanel'
import TimerPill from './timer/TimerPill'
import { useTimer } from './timer/useTimer'
import CalendarPage from './calendar/CalendarPage'
import Dashboard from './Dashboard'
import EntryForm from './EntryForm'
import EventDetail from './EventDetail'
import ExamDetail from './exams/ExamDetail'
import ExamForm from './exams/ExamForm'
import ExamsPage from './exams/ExamsPage'
import { useAuth, useDashboardPrefs, useEvents, useNow, usePlanner } from './hooks'
import ActivitiesPage from './ActivitiesPage'
import type { ActivityTemplate } from './ActivitiesPage'
import SearchPanel from './SearchPanel'
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
import { usePushQueue, useReminders } from './reminders'

type SheetState =
  | { kind: 'detail'; event: CalendarEvent }
  | { kind: 'form'; input: EntryInput; editId?: string }
  | { kind: 'task'; input: TaskInput; task?: Task }
  | { kind: 'exam'; examId: string }
  | { kind: 'examForm'; input: ExamInput; editId?: string }
  | { kind: 'create' }
  | { kind: 'more' }
  | { kind: 'search' }
  | { kind: 'assistant'; prompt?: string }
  | { kind: 'timer' }
  | null

function sectionFromHash(): Section {
  const h = window.location.hash.replace(/^#\/?/, '')
  return SECTIONS.find((s) => s.hash === h)?.id ?? 'dashboard'
}

export default function App() {
  const now = useNow()
  const theme = useTheme()
  const { session, ready, connected, recovery, endRecovery } = useAuth()
  const aiConsent = useAiConsent(session?.user.id)
  const [demo, setDemo] = useState(false)
  const mode = connected ? 'live' : demo ? 'demo' : 'off'
  const { events: sourceEvents, states, loading, reload } = useEvents(mode, ready)
  const planner = usePlanner(mode, ready)
  const labels = useLabelsData(mode, ready)
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [calendarJump, setCalendarJump] = useState<{ date: Date; n: number } | null>(null)
  const [toast, setToast] = useState<{ msg: string; action?: { label: string; run: () => void } } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const readOnly = !connected
  const [push, setPush] = useState<PushStatus | null>(null)
  const dash = useDashboardPrefs()

  // Aufgaben mit Datum und Prüfungen erscheinen im Kalender: eine Datenquelle, immer konsistent.
  const events = useMemo(
    () =>
      withLabels(
        [
          ...sourceEvents,
          ...planner.tasks.map(taskToEvent).filter((e): e is CalendarEvent => e !== null),
          ...planner.exams.map(examToEvent),
        ],
        labels.byId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceEvents, planner.tasks, planner.exams, labels.labels],
  )
  const examById = useMemo(() => new Map(planner.exams.map((x) => [x.id, x])), [planner.exams])
  const weather = useWeather(!!session)
  const assistant = useAssistant({ events, tasks: planner.tasks, exams: planner.exams, now, weather: { days: weather.days, placeSet: !!weather.place } })
  const timer = useTimer((text) => showToast(text))
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

  // Strg+K / Cmd+K öffnet die Suche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSheet({ kind: 'search' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const showToast = useCallback((msg: string, action?: { label: string; run: () => void }) => {
    setToast({ msg, action })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), action ? 7000 : 4000)
  }, [])

  useReminders(events, planner.tasks, connected, (r) => showToast(`${r.title} · ${r.body}`))
  // Nur wenn eigene Einträge und Aufgaben sicher geladen sind, sonst würden Erinnerungen gelöscht
  usePushQueue(events, planner.tasks, connected && !loading && states.find((s) => s.id === 'own')?.status === 'ok' && !planner.loading && !planner.error)

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
      const input = { ...emptyInput('event', date, now) }
      if (time) {
        input.startTime = toTimeInput(time)
        const end = new Date(time.getTime() + 60 * 60000)
        input.endTime = end.getDate() === time.getDate() ? toTimeInput(end) : '23:59'
      }
      setSheet({ kind: 'form', input: { ...input, ...extra } })
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
  /** Termin im Kalender gezogen: speichern, Google nachführen, Rückgängig anbieten. */
  const dragEntry = async (e: CalendarEvent, start: Date, end: Date | null) => {
    const before = eventToInput(e)
    const after: EntryInput = e.allDay
      ? { ...before, date: toDateInput(start) }
      : { ...before, date: toDateInput(start), startTime: toTimeInput(start), endTime: end ? (end.getDate() !== start.getDate() ? '23:59' : toTimeInput(end)) : '' }
    try {
      await updateEntry(e.externalId, after)
      if (e.kind !== 'note') await pushToGoogle({ action: 'upsert', entry_id: e.externalId })
      await reload(['own'])
      showToast(`«${e.title}» auf ${start.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}${e.allDay ? '' : `, ${toTimeInput(start)}`} verschoben.`, {
        label: 'Rückgängig',
        run: () => {
          setToast(null)
          void (async () => {
            try {
              await updateEntry(e.externalId, before)
              if (e.kind !== 'note') await pushToGoogle({ action: 'upsert', entry_id: e.externalId })
              await reload(['own'])
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Rückgängig fehlgeschlagen.')
            }
          })()
        },
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Verschieben fehlgeschlagen.')
    }
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

  const fromTemplate = (t: ActivityTemplate) => {
    const base = emptyInput('event', startOfDay(now), now)
    const [h, m] = base.startTime.split(':').map(Number)
    const endMin = Math.min(h * 60 + m + t.minutes, 23 * 60 + 59)
    setSheet({
      kind: 'form',
      input: { ...base, title: t.title, category: t.category, endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}` },
    })
  }

  const openDay = (d: Date) => {
    setCalendarJump({ date: d, n: Date.now() })
    navigate('calendar')
  }

  /** Vorschläge des KI-Planers anlegen. Jeder Vorschlag einzeln, damit ein Fehler die übrigen nicht verhindert. */
  const applyProposals = async (list: Proposal[]): Promise<{ ok: boolean[]; error?: string }> => {
    const ok: boolean[] = list.map(() => false)
    const newEntryIds: string[] = []
    const examIds = new Map<string, string>()
    let firstError = ''
    const fail = (err: unknown) => {
      firstError ||= err instanceof Error ? err.message : 'Speichern fehlgeschlagen.'
    }
    // Neue Prüfungen zuerst: Lernblöcke und Aufgaben des Plans hängen sich an ihre echte ID.
    for (const [i, p] of list.entries()) {
      if (p.kind !== 'exam') continue
      try {
        examIds.set(p.key, await createExam(p.input))
        ok[i] = true
      } catch (err) {
        fail(err)
      }
    }
    for (const [i, p] of list.entries()) {
      if (p.kind === 'exam') continue
      try {
        const examId = p.kind !== 'move' && p.examKey ? examIds.get(p.examKey) : undefined
        if (p.kind === 'event') newEntryIds.push(await createEntry(examId ? { ...p.input, examId } : p.input))
        else if (p.kind === 'task') await createTask(examId ? { ...p.input, examId } : p.input)
        else await updateTask(p.taskId, p.input, p.task.status)
        ok[i] = true
      } catch (err) {
        fail(err)
      }
    }
    for (const id of newEntryIds) await pushToGoogle({ action: 'upsert', entry_id: id })
    await Promise.all([reload(['own']), planner.reload()])
    const failed = ok.filter((x) => !x).length
    if (failed === 0) {
      const sum = summarizePlan(list)
      const text = describeSummary(sum)
      showToast(sum.exams || sum.events > 1 ? `Plan übernommen: ${text}${push?.enabled && sum.events ? ' · Google wird nachgeführt' : ''}` : ok.length === 1 ? '1 Vorschlag übernommen' : `${ok.length} Vorschläge übernommen`)
    }
    return { ok, error: failed ? `${failed} von ${ok.length} konnten nicht gespeichert werden: ${firstError}` : undefined }
  }

  if (!ready) return <div className="min-h-dvh" />
  if (recovery) return <Welcome recovery onRecoveryDone={endRecovery} onGoogle={() => void connectGoogle()} onDemo={() => setDemo(true)} />
  if (!connected && !demo) return <Welcome onGoogle={() => void connectGoogle()} onDemo={() => setDemo(true)} />

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
      case 'assistant':
        return 'Planungs-Assistent'
      case 'timer':
        return 'Timer'
      case 'examForm':
        return sheet.editId ? 'Prüfung bearbeiten' : 'Neue Prüfung'
      case 'create':
        return 'Neu erstellen'
      case 'more':
        return 'Mehr'
      case 'search':
        return 'Suchen'
      case 'detail':
        return sheet.event.kind === 'note' ? 'Notiz' : 'Details'
      default:
        return ''
    }
  })()

  return (
    <LabelsContext.Provider value={labels}>
    <div className="flex min-h-dvh">
      <div className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-canvas md:hidden" aria-hidden="true" />
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
        onSearch={() => setSheet({ kind: 'search' })}
        onAssistant={readOnly ? undefined : () => setSheet({ kind: 'assistant' })}
        onTimer={() => setSheet({ kind: 'timer' })}
      />
      <main className="min-w-0 flex-1 overflow-x-clip">
        {demo && !connected && (
          <div className="flex items-center gap-x-4 bg-surface px-5 py-1 text-sm md:px-8 lg:px-10">
            <span className="font-bold sm:mr-0">Demo-Daten</span>
            <span className="mr-auto hidden text-muted sm:inline">Erfundene Beispieldaten. Zum Speichern eigener Einträge anmelden.</span>
            <span className="mr-auto sm:hidden" />
            <button type="button" className="min-h-11 font-medium text-accent hover:underline md:min-h-0" onClick={() => setDemo(false)}>
              Anmelden
            </button>
            <button type="button" className="min-h-11 text-muted hover:text-ink md:min-h-0" onClick={() => setDemo(false)}>
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
            prefs={dash.prefs}
            onSearch={() => setSheet({ kind: 'search' })}
            onAssistant={readOnly ? undefined : () => setSheet({ kind: 'assistant' })}
            onTimer={() => setSheet({ kind: 'timer' })}
            onCreateTask={() => createTaskSheet({ dueDate: toDateInput(now) })}
            onCreateExam={createExamSheet}
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
            onCreate={(d, t, e) => create(d, t, t && e ? { endTime: e.getDate() !== t.getDate() ? '23:59' : toTimeInput(e) } : {})}
            onCreateNote={(d) => createNote(d)}
            onMove={(e, start, end) => void dragEntry(e, start, end)}
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
            onToggleTask={toggleTask}
            onOpenTask={openTask}
          />
        )}
        {section === 'activities' && <ActivitiesPage events={events} now={now} readOnly={readOnly} onOpen={openEvent} onTemplate={fromTemplate} />}
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
            hasGoogle={hasGoogleIdentity(session)}
            aiConsent={aiConsent.given}
            onRevokeAi={() => {
              aiConsent.revoke()
              assistant.clear()
            }}
            place={weather.place}
            onPlace={weather.setPlace}
            onDeleteAccount={async () => {
              await deleteAccount()
              setDemo(false)
              setSheet(null)
              assistant.clear()
            }}
            onChanged={() => void reload(['intervals'])}
            onLabelsChanged={async (deleted) => {
              await labels.reload()
              if (deleted) await Promise.all([reload(['own']), planner.reload()])
            }}
            push={push}
            onPush={(next) => {
              setPush(next)
              void reload(['own'])
            }}
            dash={dash.prefs}
            onDash={dash.toggle}
          />
        )}
      </main>

      {sheet?.kind !== 'timer' && <TimerPill state={timer.state} rest={timer.rest} onOpen={() => setSheet({ kind: 'timer' })} />}

      <BottomBar active={section} onNavigate={navigate} onMore={() => setSheet({ kind: 'more' })} badge={overdueCount} withFab={!readOnly && section !== 'settings' && section !== 'training'} />

      {!readOnly && section !== 'settings' && section !== 'training' && (
        <button
          type="button"
          onClick={fab}
          className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-30 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-accent text-accentink shadow-pop transition-transform duration-150 active:scale-95 md:hidden"
          aria-label={section === 'tasks' ? 'Neue Aufgabe' : section === 'exams' ? 'Neue Prüfung' : 'Neu erstellen'}
        >
          <Icon name="plus" size={30} />
        </button>
      )}

      {!readOnly && !sheet && (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'assistant' })}
          className={`fixed right-[1.375rem] z-30 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-float ring-1 ring-accent/20 transition-transform duration-150 active:scale-95 md:hidden ${
            section !== 'settings' && section !== 'training' ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'
          }`}
          aria-label="Planungs-Assistent öffnen"
        >
          <Icon name="sparkle" size={22} />
        </button>
      )}

      {toast && (
        <div role="status" className="anim-sheet fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-2xl bg-deep py-2.5 pl-4 pr-2 text-sm text-deepink shadow-float md:bottom-6">
          <span className="min-w-0">{toast.msg}</span>
          {toast.action && (
            <button type="button" onClick={toast.action.run} className="min-h-9 shrink-0 rounded-xl bg-accent px-3 text-sm font-semibold text-accentink">
              {toast.action.label}
            </button>
          )}
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
            onAskAssistant={!readOnly ? (prompt) => setSheet({ kind: 'assistant', prompt }) : undefined}
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
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { icon: 'calendar', label: 'Termin', text: 'Mit Uhrzeit im Kalender', tint: 'cat-work', go: () => create(startOfDay(now)) },
                { icon: 'tasks', label: 'Aufgabe', text: 'Mit Fälligkeit und Priorität', tint: 'cat-private', go: () => createTaskSheet() },
                { icon: 'note', label: 'Notiz', text: 'An einem Tag, ohne Uhrzeit', tint: 'col-amber', go: () => createNote(now) },
                { icon: 'exam', label: 'Prüfung', text: 'Mit Lernaufgaben planen', tint: 'cat-training', go: () => createExamSheet() },
              ] as { icon: IconName; label: string; text: string; tint: string; go: () => void }[]
            ).map((o) => (
              <button key={o.label} type="button" onClick={o.go} className={`${o.tint} flex flex-col items-start gap-3 rounded-3xl bg-cat/[0.13] p-4 text-left transition duration-150 hover:bg-cat/[0.2] active:scale-[0.98]`}>
                <span className="dot-cat h-11 w-11">
                  <Icon name={o.icon} size={20} />
                </span>
                <span>
                  <span className="block text-[15px] font-extrabold">{o.label}</span>
                  <span className="block text-xs font-medium text-muted">{o.text}</span>
                </span>
              </button>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'assistant', prompt: 'Ich möchte eine neue Prüfung einplanen. Frag mich nach Fach, Datum, Uhrzeit und Themen, erkläre mir dann das Vorgehen und mach mir einen Plan mit Lernblöcken.' })}
                className="cat-study col-span-2 flex items-center gap-3 rounded-3xl bg-cat/[0.13] p-4 text-left transition duration-150 hover:bg-cat/[0.2] active:scale-[0.98]"
              >
                <span className="dot-cat h-11 w-11 shrink-0">
                  <Icon name="sparkle" size={20} />
                </span>
                <span>
                  <span className="block text-[15px] font-extrabold">Prüfung mit Assistent</span>
                  <span className="block text-xs font-medium text-muted">Vorgehen erklären, Plan machen, in den Kalender eintragen</span>
                </span>
              </button>
            )}
          </div>
        )}
        {sheet?.kind === 'assistant' && (
          <AssistantPanel chat={assistant} consent={aiConsent.given} onConsent={aiConsent.give} suggestions={quickPrompts(planner.exams, planner.tasks, now)} onApply={applyProposals} place={weather.place} onPlace={weather.setPlace} autoPrompt={sheet.prompt} />
        )}
        {sheet?.kind === 'search' && (
          <SearchPanel
            events={events}
            tasks={planner.tasks}
            exams={planner.exams}
            now={now}
            readOnly={readOnly}
            onOpenEvent={openEvent}
            onOpenTask={openTask}
            onToggleTask={toggleTask}
            onOpenExam={(x) => setSheet({ kind: 'exam', examId: x.id })}
          />
        )}
        {sheet?.kind === 'timer' && (
          <TimerPanel
            timer={timer}
            tasks={planner.tasks.filter((t) => t.status !== 'done')}
            onSaveSession={
              readOnly
                ? undefined
                : async (input) => {
                    await createEntry(input)
                    await reload(['own'])
                  }
            }
          />
        )}
        {sheet?.kind === 'more' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <button type="button" onClick={() => setSheet({ kind: 'timer' })} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface2">
                <Icon name="timer" size={20} className="text-accent" />
                <span className="flex-1 font-medium">Timer</span>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </button>
              {!readOnly && (
                <button type="button" onClick={() => setSheet({ kind: 'assistant' })} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface2">
                  <Icon name="sparkle" size={20} className="text-accent" />
                  <span className="flex-1 font-medium">Planungs-Assistent</span>
                  <Icon name="chevronRight" size={16} className="text-muted" />
                </button>
              )}
              <button type="button" onClick={() => setSheet({ kind: 'search' })} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface2">
                <Icon name="search" size={20} className="text-muted" />
                <span className="flex-1 font-medium">Suchen</span>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </button>
              {SECTIONS.filter((s) => s.id === 'activities' || s.id === 'training' || s.id === 'settings').map((s) => (
                <button key={s.id} type="button" onClick={() => navigate(s.id)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface2">
                  <Icon name={s.icon} size={20} className="text-accent" />
                  <span className="flex-1 font-medium">{s.label}</span>
                  <Icon name="chevronRight" size={16} className="text-muted" />
                </button>
              ))}
              {connected && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Möchtest du dich abmelden?')) {
                      setSheet(null)
                      void disconnectGoogle()
                    }
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface2"
                >
                  <Icon name="logout" size={20} className="text-muted" />
                  <span className="flex-1 font-medium">Abmelden</span>
                </button>
              )}
            </div>
            <div className="pt-2">
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
    </LabelsContext.Provider>
  )
}
