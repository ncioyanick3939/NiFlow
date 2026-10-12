import { addDays, formatTime, isSameDay, startOfWeek } from '../../domain/dateUtils'
import { eventsForDay } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import Icon from '../icons'
import { catClass } from '../kit'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  month: Date
  events: CalendarEvent[]
  now: Date
  onOpen: (e: CalendarEvent) => void
  onPickDay: (d: Date) => void
}

export default function MonthView({ month, events, now, onOpen, onPickDay }: Props) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  // Letzte Zeile weglassen, wenn sie komplett im Folgemonat liegt.
  const visible = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {visible.map((d, i) => {
          const { timed, allDay } = eventsForDay(events, d)
          const all = [...allDay, ...timed]
          const inMonth = d.getMonth() === month.getMonth()
          const today = isSameDay(d, now)
          return (
            <div
              key={d.getTime()}
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(d)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  onPickDay(d)
                }
              }}
              aria-label={`${d.getDate()}. ${all.length} Einträge, Tag öffnen`}
              className={`min-h-[4.5rem] cursor-pointer border-line p-1 transition-colors hover:bg-surface2 md:min-h-[7.5rem] md:p-1.5 ${i % 7 !== 0 ? 'border-l' : ''} ${
                i >= 7 ? 'border-t' : ''
              } ${inMonth ? '' : 'bg-surface2/40'}`}
            >
              <span
                className={`tnum mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  today ? 'bg-accent text-accentink' : inMonth ? '' : 'text-muted/60'
                }`}
              >
                {d.getDate()}
              </span>
              {/* Handy: nur Punkte */}
              <div className="flex flex-wrap gap-1 px-1 md:hidden">
                {all.slice(0, 5).map((e) => (
                  <span key={e.id} className={`${catClass(e.category)} h-1.5 w-1.5 rounded-full ${e.kind === 'note' ? 'border border-cat' : 'bg-cat'}`} aria-hidden="true" />
                ))}
              </div>
              {/* Desktop: Einträge */}
              <div className="hidden space-y-0.5 md:block">
                {all.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpen(e)
                    }}
                    className={`${catClass(e.category)} flex w-full items-center gap-1.5 truncate rounded-sm px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-cat/15 ${
                      e.allDay && e.kind !== 'note' ? 'bg-cat/15 font-medium' : ''
                    }`}
                  >
                    {e.kind === 'note' || e.kind === 'task' ? (
                      <Icon name={e.kind === 'note' ? 'note' : e.done ? 'checkCircle' : 'circle'} size={11} className="shrink-0 text-muted" />
                    ) : (
                      !e.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cat" aria-hidden="true" />
                    )}
                    {!e.allDay && <span className="tnum shrink-0 text-muted">{formatTime(e.start)}</span>}
                    <span className={`truncate ${e.done ? 'text-muted line-through' : ''} ${e.kind === 'exam' ? 'font-semibold' : ''}`}>{e.title}</span>
                  </button>
                ))}
                {all.length > 3 && <p className="px-1 text-[11px] font-medium text-muted">+{all.length - 3} weitere</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
