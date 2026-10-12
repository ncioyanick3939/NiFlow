import { useState } from 'react'
import { addDays, isoWeek, isSameDay, startOfDay, startOfWeek } from '../../domain/dateUtils'
import { eventsForDay } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { weekDays } from '../../domain/weekLayout'
import { useMediaQuery, useStoredState } from '../hooks'
import Icon from '../icons'
import { Segmented } from '../kit'
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
}

const fmtMonth = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' })
const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' })

export default function CalendarPage({ initialDate, events, now, loading, readOnly, onOpen, onCreate }: Props) {
  const [stored, setView] = useStoredState<CalView>('niflow-calendar-view', 'week', VIEWS)
  const [forced, setForced] = useState<CalView | null>(initialDate ? 'day' : null)
  const view = forced ?? stored
  const [anchor, setAnchor] = useState(() => startOfDay(initialDate ?? now))
  const wide = useMediaQuery('(min-width: 768px)')

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
  const sub = view === 'week' || view === 'day' ? `Kalenderwoche ${isoWeek(anchor)}` : null

  const pickDay = (d: Date) => {
    setAnchor(startOfDay(d))
    setForced('day')
  }
  const createAt = readOnly ? undefined : (at: Date) => onCreate(startOfDay(at), at)

  // Wochenansicht auf dem Handy: Tagesleiste + ein Tag, damit Titel lesbar bleiben.
  const strip = (
    <div className="mb-3 grid grid-cols-7 gap-1">
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
            className={`flex min-h-14 flex-col items-center justify-center rounded-md transition-colors ${
              sel ? 'bg-accent text-accentink' : 'hover:bg-surface2'
            }`}
          >
            <span className={`text-[10px] font-medium uppercase ${sel ? '' : today ? 'text-accent' : 'text-muted'}`}>
              {new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(d).replace('.', '')}
            </span>
            <span className="tnum text-sm font-semibold">{d.getDate()}</span>
            <span className={`mt-0.5 h-1 w-1 rounded-full ${count > 0 ? (sel ? 'bg-accentink' : 'bg-muted') : 'bg-transparent'}`} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-2xl font-semibold capitalize tracking-tight">{title}</h1>
          {sub && <p className="tnum text-sm text-muted">{sub}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost h-10 min-h-10 w-10 px-0" onClick={() => shift(-1)} aria-label="Zurück">
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="btn-outline min-h-10 px-3" onClick={() => setAnchor(startOfDay(now))}>
            Heute
          </button>
          <button type="button" className="btn-ghost h-10 min-h-10 w-10 px-0" onClick={() => shift(1)} aria-label="Weiter">
            <Icon name="chevronRight" size={18} />
          </button>
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
        {!readOnly && (
          <button type="button" className="btn-primary hidden md:inline-flex" onClick={() => onCreate(anchor)}>
            <Icon name="plus" size={16} /> Neu
          </button>
        )}
      </div>

      {loading && events.length === 0 && <p className="mb-3 text-sm text-muted">Lädt Einträge …</p>}

      {view === 'month' && <MonthView month={anchor} events={events} now={now} onOpen={onOpen} onPickDay={pickDay} />}

      {view === 'week' &&
        (wide ? (
          <TimeGrid days={week} events={events} now={now} onOpen={onOpen} onCreateAt={createAt} onPickDay={pickDay} />
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
        <p className="mt-3 hidden text-xs text-muted md:block">Tipp: In eine freie Stelle im Raster klicken, um dort einen Termin anzulegen.</p>
      )}
    </div>
  )
}
