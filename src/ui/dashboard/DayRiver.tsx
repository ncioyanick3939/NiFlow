import { atTime, formatTime } from '../../domain/dateUtils'
import { blocksTime } from '../../domain/schedule'
import type { FreeSlot } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { layoutDay } from '../../domain/weekLayout'
import { catClass } from '../kit'

const START = 6
const END = 22
const TICKS = [6, 9, 12, 15, 18, 21]

/**
 * Der Tag als Fluss: Zeitleiste 06–22 Uhr mit den heutigen Terminen, freien Lernfenstern
 * und einer Markierung für jetzt. Gedacht für den dunklen Tagesbereich.
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
      <div className="relative h-14 rounded-md bg-deepink/[0.07]">
        {TICKS.slice(1).map((h) => (
          <span
            key={h}
            className="absolute inset-y-0 w-px bg-deepink/10"
            style={{ left: `${((h - START) / (END - START)) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {free
          .filter((f) => f.study)
          .map((f) => (
            <span
              key={f.start.getTime()}
              className="absolute inset-y-1.5 rounded-sm border border-dashed border-sun/60"
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
            onClick={() => onOpen(b.event)}
            title={`${formatTime(b.event.start)} ${b.event.title}`}
            className={`${catClass(b.event.category)} absolute rounded-[6px] bg-cat transition-[filter] hover:brightness-110 ${
              (b.event.end ?? b.event.start) < now ? 'opacity-45' : ''
            }`}
            style={{
              left: `${b.left * 100}%`,
              width: `max(${b.width * 100}%, 6px)`,
              top: `calc(${(b.lane / b.lanes) * 100}% + 4px)`,
              height: `calc(${100 / b.lanes}% - 8px)`,
            }}
          >
            <span className="sr-only">{b.event.title}</span>
          </button>
        ))}
        {showNow && (
          <span className="pointer-events-none absolute -inset-y-1.5 z-10 w-0.5 rounded-full bg-sun" style={{ left: `${nowPct}%` }} aria-hidden="true">
            <span className="absolute -left-[5px] -top-1 h-3 w-3 rounded-full bg-sun ring-4 ring-deep" />
          </span>
        )}
      </div>
      <div className="relative mt-1.5 h-4" aria-hidden="true">
        {TICKS.map((h, i) => (
          <span
            key={h}
            className={`tnum absolute text-[11px] text-deepmuted ${i === 0 ? '' : '-translate-x-1/2'}`}
            style={{ left: `${((h - START) / (END - START)) * 100}%` }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  )
}
