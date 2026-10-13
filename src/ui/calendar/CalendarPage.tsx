import { useState } from 'react'
import { addDays, isoWeek, isSameDay, startOfDay, startOfWeek } from '../../domain/dateUtils'
import { eventsForDay } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { weekDays } from '../../domain/weekLayout'
import { useMediaQuery, useStoredState } from '../hooks'
import Icon from '../icons'
import { EventRow, Segmented } from '../kit'
import AgendaView from './AgendaView'
import MonthView from './MonthView'
import TimeGrid from './TimeGrid'

export type CalView = 'month' | 'week' | 'day' | 'agenda'
const VIEWS: readonly CalView[] = ['month', 'week', 'day', 'agenda']

interface Props {
  /** Von aussen gewünschter Tag (z. B. Klick in der Übersicht): öffnet die Tagesansicht. */
  initialDate?: Date
  events: CalendarEvent[]
  now: Date
  loading: boolean
  /** Demo-Modus: keine Erstell-Aktionen. */
  readOnly: boolean
  onOpen: (e: CalendarEvent) => void
  onCreate: (date: Date, time?: Date) => void
  onCreateNote: (date: Date) => void
}

const fmtMonth = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' })
const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' })
const fmtWd = new Intl.DateTimeFormat('de-CH', { weekday: 'short' })

/**
 * Kalender über die ganze Breite. Eine Toolbar für Zeitraum, Navigation und Ansicht.
 * Rechts eine einklappbare Tagesleiste mit Notizen, Aufgaben und den nächsten Terminen.
 */
export default function CalendarPage({ initialDate, events, now, loading, readOnly, onOpen, onCreate, onCreateNote }: Props) {
  const [stored, setView] = useStoredState<CalView>('niflow-calendar-view', 'week', VIEWS)
  const [forced, setForced] = useState<CalView | null>(initialDate ? 'day' : null)
  const view = forced ?? stored
  const [anchor, setAnchor] = useState(() => startOfDay(initialDate ?? now))
  const [railPref, setRailPref] = useStoredState<'open' | 'closed'>('niflow-calendar-rail', 'open', ['open', 'closed'] as const)
  const wide = useMediaQuery('(min-width: 768px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const rail = xl && railPref === 'open'

  const shift = (dir: 1 | -1) => {
    if (view === 'month') setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1))
    else if (view === 'day') setAnchor((a) => addDays(a, dir))
    else setAnchor((a) => addDays(a, 7 * dir))
  }

  const week = weekDays(startOfWeek(anchor))
  const title =
    view === 'month'
      ? fmtMonth.format(anchor)
      : view === 'day'
        ? fmtDay.format(anchor)
        : view === 'week'
          ? `${fmtShort.format(week[0])} – ${fmtShort.format(week[6])}`
          : `Ab ${fmtDay.format(anchor)}`

  /** Monat: mit Seitenleiste nur auswählen, sonst Tag öffnen. */
  const pickDay = (d: Date) => {
    setAnchor(startOfDay(d))
    if (!(view === 'month' && rail)) setForced('day')
  }
  const createAt = readOnly ? undefined : (at: Date) => onCreate(startOfDay(at), at)

  const strip = (
    <div className="mb-3 grid grid-cols-7 gap-1 rounded-xl bg-surface p-1.5">
      {week.map((d) => {
        const sel = isSameDay(d, anchor)
        const today = isSameDay(d, now)
        const { timed, allDay } = eventsForDay(events, d)
        const count = timed.length + allDay.length
        return (
          <button
            key={d.getTime()}
            type="button"
            onClick={() => setAnchor(d)}
            aria-pressed={sel}
            className={`flex min-h-[3.75rem] flex-col items-center justify-center rounded-lg transition-colors ${sel ? 'bg-deep text-deepink' : 'hover:bg-surface2'}`}
          >
            <span className={`text-[11px] font-medium ${sel ? 'text-deepmuted' : today ? 'text-ink' : 'text-muted'}`}>{fmtWd.format(d).replace('.', '')}</span>
            <span className={`h-display tnum text-lg leading-tight ${today && !sel ? 'text-accent' : ''}`}>{d.getDate()}</span>
            <span className={`mt-0.5 h-1 w-1 rounded-full ${count > 0 ? (sel ? 'bg-sun' : 'bg-muted') : 'bg-transparent'}`} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="flex min-h-dvh w-full flex-col px-4 pb-28 pt-5 md:px-6 md:pb-8 lg:px-8">
      {/* Toolbar: alles in einer Zeile (auf dem Handy umbrechend) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-outline min-h-10 px-4" onClick={() => setAnchor(startOfDay(now))}>
            Heute
          </button>
          <button type="button" className="btn-ghost h-10 min-h-10 w-10 px-0" onClick={() => shift(-1)} aria-label="Zurück">
            <Icon name="chevronLeft" size={20} />
          </button>
          <button type="button" className="btn-ghost h-10 min-h-10 w-10 px-0" onClick={() => shift(1)} aria-label="Weiter">
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
        <div className="mr-auto flex min-w-0 items-baseline gap-3">
          <h1 className="h-display truncate text-[24px] capitalize leading-tight md:text-[28px]">{title}</h1>
          {(view === 'week' || view === 'day') && <span className="tnum hidden shrink-0 text-sm text-muted sm:inline">KW {isoWeek(anchor)}</span>}
        </div>
        <Segmented
          label="Ansicht"
          value={view}
          onChange={(v) => {
            setForced(null)
            setView(v)
          }}
          options={[
            { value: 'month', label: 'Monat' },
            { value: 'week', label: 'Woche' },
            { value: 'day', label: 'Tag' },
            { value: 'agenda', label: 'Agenda' },
          ]}
        />
        {xl && (
          <button
            type="button"
            className={`btn-ghost h-10 min-h-10 w-10 px-0 ${rail ? 'bg-surface2' : ''}`}
            onClick={() => setRailPref(rail ? 'closed' : 'open')}
            aria-pressed={rail}
            aria-label={rail ? 'Tagesleiste ausblenden' : 'Tagesleiste einblenden'}
            title="Tagesleiste"
          >
            <Icon name="layers" size={18} />
          </button>
        )}
        {!readOnly && (
          <button type="button" className="btn-primary hidden min-h-10 md:inline-flex" onClick={() => onCreate(anchor)}>
            <Icon name="plus" size={16} /> Neuer Termin
          </button>
        )}
      </div>

      {loading && events.length === 0 && <p className="mb-3 text-sm text-muted">Lädt Einträge …</p>}

      <div className={`grid flex-1 gap-5 ${rail ? 'grid-cols-[minmax(0,1fr),300px]' : 'grid-cols-1'}`}>
        <div className="min-w-0">
          {view === 'month' && <MonthView selected={rail ? anchor : undefined} month={anchor} events={events} now={now} onOpen={onOpen} onPickDay={pickDay} />}

          {view === 'week' &&
            (wide ? (
              <TimeGrid days={week} events={events} now={now} onOpen={onOpen} onCreateAt={createAt} onPickDay={(d) => { setAnchor(d); setForced('day') }} />
            ) : (
              <>
                {strip}
                <TimeGrid days={[anchor]} events={events} now={now} onOpen={onOpen} onCreateAt={createAt} />
              </>
            ))}

          {view === 'day' && (
            <>
              {strip}
              <TimeGrid days={[anchor]} events={events} now={now} onOpen={onOpen} onCreateAt={createAt} />
            </>
          )}

          {view === 'agenda' && (
            <AgendaView from={anchor} days={30} events={events} now={now} onOpen={onOpen} onCreate={readOnly ? undefined : () => onCreate(anchor)} />
          )}

          {!readOnly && (view === 'week' || view === 'day') && (
            <p className="mt-3 hidden text-xs text-muted md:block">Klick in eine freie Stelle im Raster legt dort einen Termin an.</p>
          )}
        </div>

        {rail && <DayRail day={anchor} events={events} now={now} readOnly={readOnly} onOpen={onOpen} onCreateNote={onCreateNote} onOpenDay={() => setForced('day')} showOpen={view !== 'day'} />}
      </div>
    </div>
  )
}

/** Tagesleiste: Notizen, Aufgaben und die nächsten Termine zum gewählten Tag. */
function DayRail({
  day,
  events,
  now,
  readOnly,
  onOpen,
  onCreateNote,
  onOpenDay,
  showOpen,
}: {
  day: Date
  events: CalendarEvent[]
  now: Date
  readOnly: boolean
  onOpen: (e: CalendarEvent) => void
  onCreateNote: (d: Date) => void
  onOpenDay: () => void
  showOpen: boolean
}) {
  const { allDay, timed } = eventsForDay(events, day)
  const items = [...allDay, ...timed]
  const notes = items.filter((e) => e.kind === 'note')
  const tasks = items.filter((e) => e.kind === 'task')
  const dayItems = items.filter((e) => e.kind !== 'note' && e.kind !== 'task')
  const upcoming = events
    .filter((e) => e.start >= now && !e.allDay && e.kind !== 'task' && e.kind !== 'note')
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5)
  const isToday = isSameDay(day, now)

  return (
    <aside className="space-y-5 self-start rounded-xl bg-surface p-5" aria-label="Tagesleiste">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{isToday ? 'Heute' : fmtWd.format(day).replace('.', '')}</p>
          <p className="h-display text-[22px] leading-tight">{fmtDay.format(day).split(', ').pop()}</p>
        </div>
        {showOpen && (
          <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={onOpenDay}>
            Tag öffnen
          </button>
        )}
      </div>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Notizen</h2>
          {!readOnly && (
            <button type="button" className="btn-ghost h-8 min-h-8 px-2 text-xs text-accent" onClick={() => onCreateNote(day)}>
              <Icon name="plus" size={14} /> Notiz
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted">Keine Notiz für diesen Tag.</p>
        ) : (
          notes.map((n) => (
            <button key={n.id} type="button" onClick={() => onOpen(n)} className="mb-1.5 block w-full rounded-md bg-surface2 px-3 py-2 text-left transition-colors hover:bg-line/60">
              <span className="block truncate text-sm font-medium">{n.title}</span>
              {n.description && <span className="line-clamp-2 block text-xs text-muted">{n.description}</span>}
            </button>
          ))
        )}
      </section>

      {tasks.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Fällige Aufgaben</h2>
          {tasks.map((e) => (
            <EventRow key={e.id} e={e} onOpen={onOpen} />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold">An diesem Tag</h2>
        {dayItems.length === 0 ? <p className="text-sm text-muted">Keine Termine.</p> : dayItems.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} dim={(e.end ?? e.start) < now} />)}
      </section>

      {!isToday || upcoming.length > 0 ? (
        <section className="border-t border-line/70 pt-4">
          <h2 className="mb-1 text-sm font-semibold">Als Nächstes</h2>
          {upcoming.length === 0 ? <p className="text-sm text-muted">Nichts geplant.</p> : upcoming.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} showDay />)}
        </section>
      ) : null}
    </aside>
  )
}
