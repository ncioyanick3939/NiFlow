import { useCallback, useEffect, useState } from 'react'
import { createEntry, deleteEntry, updateEntry } from '../data/entries'
import { formatTime } from '../domain/dateUtils'
import { emptyInput, eventToInput, toTimeInput } from '../domain/entries'
import type { EntryInput } from '../domain/entries'
import type { CalendarEvent } from '../domain/types'
import { connectGoogle, disconnectGoogle } from '../lib/supabase'
import CalendarPage from './calendar/CalendarPage'
import Dashboard from './Dashboard'
import EntryForm from './EntryForm'
import EventDetail from './EventDetail'
import { useAuth, useEvents, useNow } from './hooks'
import Icon from './icons'
import { Sheet } from './kit'
import { BottomBar, SECTIONS, Sidebar } from './Nav'
import type { Section } from './Nav'
import SettingsView from './SettingsView'
import { useTheme } from './theme'
import TrainingPage from './TrainingPage'
import Welcome from './Welcome'

type SheetState = { kind: 'detail'; event: CalendarEvent } | { kind: 'form'; input: EntryInput; editId?: string } | null

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
  const { events, states, loading, reload } = useEvents(mode, ready)
  const [section, setSection] = useState<Section>(sectionFromHash)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [calendarJump, setCalendarJump] = useState<{ date: Date; n: number } | null>(null)
  const readOnly = !connected

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((s: Section) => {
    setSection(s)
    const hash = SECTIONS.find((x) => x.id === s)!.hash
    if (window.location.hash !== `#/${hash}`) window.history.pushState(null, '', `#/${hash}`)
    window.scrollTo({ top: 0 })
  }, [])

  const close = useCallback(() => setSheet(null), [])
  const openEvent = useCallback((e: CalendarEvent) => setSheet({ kind: 'detail', event: e }), [])

  const create = useCallback(
    (date: Date, time?: Date) => {
      const input = emptyInput('event', date, now)
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

  const save = async (input: EntryInput, editId?: string) => {
    if (editId) await updateEntry(editId, input)
    else await createEntry(input)
    setSheet(null)
    await reload(['own'])
  }
  const move = async (e: CalendarEvent, input: EntryInput) => {
    await updateEntry(e.externalId, input)
    setSheet(null)
    await reload(['own'])
  }
  const remove = async (e: CalendarEvent) => {
    await deleteEntry(e.externalId)
    setSheet(null)
    await reload(['own'])
  }
  const quickNote = async (title: string) => {
    await createEntry({ ...emptyInput('note', now), title })
    await reload(['own'])
  }
  const openDay = (d: Date) => {
    setCalendarJump({ date: d, n: Date.now() })
    navigate('calendar')
  }

  if (!ready) return <div className="min-h-dvh" />
  if (!connected && !demo) return <Welcome onConnect={() => void connectGoogle()} onDemo={() => setDemo(true)} />

  const errors = states.filter((s) => s.status === 'error')
  const googleReauth = errors.some((s) => s.id === 'google')
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined
  const firstName = (meta?.full_name ?? meta?.name ?? '').split(' ')[0] || null

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        active={section}
        onNavigate={navigate}
        onCreate={readOnly ? undefined : () => create(new Date())}
        states={states}
        loading={loading}
        onReload={() => void reload()}
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
        {errors.length > 0 && (
          <div className="border-b border-danger/20 bg-danger/[0.06] px-4 py-2.5 md:px-8" role="alert">
            {errors.map((s) => (
              <p key={s.id} className="flex flex-wrap items-center gap-x-3 text-sm">
                <Icon name="alert" size={15} className="shrink-0 text-danger" />
                <span className="mr-auto">
                  <span className="font-semibold">{s.label}:</span> {s.error}
                  {s.lastSync && <span className="text-muted"> Zuletzt erfolgreich {formatTime(s.lastSync)} Uhr.</span>}
                </span>
                {s.id === 'google' && googleReauth && (
                  <button type="button" className="font-medium text-accent hover:underline" onClick={() => void connectGoogle()}>
                    Neu verbinden
                  </button>
                )}
              </p>
            ))}
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
            onCreate={create}
            onCreateNote={(d) => createNote(d)}
            onQuickNote={quickNote}
            onOpenDay={openDay}
            onGoTraining={() => navigate('training')}
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
            onCreate={create}
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
          />
        )}
      </main>

      <BottomBar active={section} onNavigate={navigate} />

      {!readOnly && section !== 'settings' && (
        <button
          type="button"
          onClick={() => create(new Date())}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accentink shadow-sheet transition-transform active:scale-95 md:hidden"
          aria-label="Neuer Eintrag"
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      <Sheet
        open={sheet !== null}
        onClose={close}
        title={
          sheet?.kind === 'form'
            ? sheet.editId
              ? sheet.input.type === 'note'
                ? 'Notiz bearbeiten'
                : 'Termin bearbeiten'
              : 'Neuer Eintrag'
            : sheet?.kind === 'detail' && sheet.event.kind === 'note'
              ? 'Notiz'
              : 'Details'
        }
      >
        {sheet?.kind === 'detail' && (
          <EventDetail
            event={sheet.event}
            readOnly={readOnly}
            onEdit={(e) => setSheet({ kind: 'form', input: eventToInput(e), editId: e.externalId })}
            onMove={move}
            onDelete={remove}
            onAddNote={(date, title) => createNote(date, `Notiz: ${title}`)}
          />
        )}
        {sheet?.kind === 'form' && (
          <EntryForm
            key={sheet.editId ?? 'new'}
            initial={sheet.input}
            editing={!!sheet.editId}
            onSave={(input) => save(input, sheet.editId)}
            onCancel={close}
          />
        )}
      </Sheet>
    </div>
  )
}

