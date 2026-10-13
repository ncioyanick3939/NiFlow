import { addDays, formatDateLong, formatWeekday, isSameDay, startOfDay } from '../../domain/dateUtils'
import { eventsForDay } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { EmptyState, EventRow } from '../kit'

interface Props {
  from: Date
  days: number
  events: CalendarEvent[]
  now: Date
  onOpen: (e: CalendarEvent) => void
  onCreate?: () => void
}

/** Liste nach Tagen. Tage ohne Einträge werden ausgelassen. */
export default function AgendaView({ from, days, events, now, onOpen, onCreate }: Props) {
  const groups = Array.from({ length: days }, (_, i) => addDays(startOfDay(from), i))
    .map((d) => {
      const { allDay, timed } = eventsForDay(events, d)
      return { date: d, items: [...allDay, ...timed] }
    })
    .filter((g) => g.items.length > 0)

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-surface">
        <EmptyState
          icon="calendar"
          title={`Keine Einträge in den nächsten ${days} Tagen`}
          text="Hier erscheinen deine Termine, Notizen und importierten Einträge der Reihe nach."
          action={onCreate && <button type="button" className="btn-primary" onClick={onCreate}>Eintrag erstellen</button>}
        />
      </div>
    )
  }

  return (
    <div className="divide-y divide-line/60 rounded-xl bg-surface px-4 md:px-6">
      {groups.map((g) => {
        const today = isSameDay(g.date, now)
        const past = g.date < startOfDay(now)
        return (
          <section key={g.date.getTime()} className="grid grid-cols-[minmax(0,1fr)] gap-x-6 py-4 md:grid-cols-[10rem,minmax(0,1fr)]">
            <header className="mb-1 flex items-baseline gap-3 md:mb-0 md:block md:pt-2">
              <p className={`h-display text-lg capitalize leading-tight ${today ? 'text-accent' : ''}`}>{today ? 'Heute' : formatWeekday(g.date)}</p>
              <p className="tnum text-sm text-muted">{formatDateLong(g.date)}</p>
            </header>
            <div className="min-w-0">
              {g.items.map((e) => (
                <EventRow key={e.id} e={e} onOpen={onOpen} dim={past} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
