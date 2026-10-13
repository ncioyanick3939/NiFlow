import { atTime, formatTime } from '../../domain/dateUtils'
import { evClass } from '../labels'
import { blocksTime } from '../../domain/schedule'
import type { FreeSlot } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { layoutDay } from '../../domain/weekLayout'

const START = 6
const END = 22
const TICKS = [6, 9, 12, 15, 18, 21]

/**
 * Der Tag als Fluss: Zeitleiste 06–22 Uhr mit den heutigen Terminen, freien Lernfenstern
 * und einer Markierung für jetzt. Schmale Leiste über dem Tagesplan.
 */
export default function DayRiver({
  timed,
  free,
  day,
  now,
  onOpen,
}: {
  timed: CalendarEvent[]
  free: FreeSlot[]
  day: Date
  now: Date
  onOpen: (e: CalendarEvent) => void
}) {
  const ws = atTime(day, START).getTime()
  const we = atTime(day, END).getTime()
  const pct = (t: number) => Math.min(Math.max(((t - ws) / (we - ws)) * 100, 0), 100)
  const blocks = layoutDay(timed.filter(blocksTime), day)
  const nowPct = pct(now.getTime())
  const showNow = now.getTime() >= ws && now.getTime() <= we

  return (
    <div>
      <div className="relative h-9 border-y border-line">
        {TICKS.slice(1).map((h) => (
          <span
            key={h}
            className="absolute inset-y-0 w-px bg-line"
            style={{ left: `${((h - START) / (END - START)) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {free
          .filter((f) => f.study)
          .map((f) => (
            <span
              key={f.start.getTime()}
              className="absolute inset-y-1.5 border border-dashed border-muted/60"
              style={{
                left: `${pct(f.study!.start.getTime())}%`,
                width: `${pct(f.study!.end.getTime()) - pct(f.study!.start.getTime())}%`,
              }}
              title={`Frei für einen Lernblock: ${formatTime(f.study!.start)}–${formatTime(f.study!.end)}`}
              aria-hidden="true"
            />
          ))}
        {blocks.map((b) => (
          <button
            key={b.event.id}
            type="button"
            tabIndex={-1}
            onClick={() => onOpen(b.event)}
            title={`${formatTime(b.event.start)} ${b.event.title}`}
            className={`${evClass(b.event)} absolute bg-cat transition-[filter] duration-150 hover:brightness-110 ${
              (b.event.end ?? b.event.start) < now ? 'opacity-35' : ''
            }`}
            style={{
              left: `${b.left * 100}%`,
              width: `max(${b.width * 100}%, 6px)`,
              top: `calc(${(b.lane / b.lanes) * 100}% + 5px)`,
              height: `calc(${100 / b.lanes}% - 10px)`,
            }}
          >
            <span className="sr-only">{b.event.title}</span>
          </button>
        ))}
        {showNow && (
          <span className="pointer-events-none absolute -inset-y-1 z-10 w-px bg-accent" style={{ left: `${nowPct}%` }} aria-hidden="true">
            <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] bg-accent" />
          </span>
        )}
      </div>
      <div className="relative mt-1.5 h-4" aria-hidden="true">
        {TICKS.map((h, i) => (
          <span
            key={h}
            className={`tnum absolute text-[11px] text-muted ${i === 0 ? '' : '-translate-x-1/2'}`}
            style={{ left: `${((h - START) / (END - START)) * 100}%` }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  )
}
