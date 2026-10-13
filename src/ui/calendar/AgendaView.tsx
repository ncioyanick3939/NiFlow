import { addDays, formatWeekday, isSameDay, startOfDay } from '../../domain/dateUtils'
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
      <div className="rounded border border-line bg-surface">
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
    <div className="divide-y divide-line border-y border-line">
      {groups.map((g) => {
        const today = isSameDay(g.date, now)
        const past = g.date < startOfDay(now)
        return (
          <section key={g.date.getTime()} className="grid grid-cols-[minmax(0,1fr)] gap-x-8 py-3 md:grid-cols-[9.5rem,minmax(0,1fr)]">
            <header className="flex items-baseline gap-3 py-1 md:block md:pt-3">
              <p className={`text-[17px] font-semibold capitalize leading-tight tracking-[-0.01em] ${today ? 'text-accent' : ''}`}>{today ? 'Heute' : formatWeekday(g.date)}</p>
              <p className="tnum text-[13px] text-muted">{g.date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </header>
            <div className="min-w-0 divide-y divide-line/60">
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
