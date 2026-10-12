import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { addDays, formatTime, formatWeekdayShort, isSameDay, startOfDay } from '../../domain/dateUtils'
import { eventsForDay, findOverlaps } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { layoutDay } from '../../domain/weekLayout'
import Icon from '../icons'
import { catClass } from '../kit'

const HOUR_PX = 52
const DAY_PX = HOUR_PX * 24
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  days: Date[]
  events: CalendarEvent[]
  now: Date
  onOpen: (e: CalendarEvent) => void
  /** Klick auf eine freie Stelle: neuer Termin zu dieser Zeit. Fehlt im Demo-Modus. */
  onCreateAt?: (at: Date) => void
  onPickDay?: (d: Date) => void
}

/** Zeitraster für einen oder mehrere Tage (Tages- und Wochenansicht). */
export default function TimeGrid({ days, events, now, onOpen, onCreateAt, onPickDay }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const multi = days.length > 1
  const perDay = days.map((d) => ({ date: d, ...eventsForDay(events, d) }))
  const hasAllDay = perDay.some((d) => d.allDay.length > 0)
  const firstKey = days[0]?.getTime()

  // Beim Öffnen zur sinnvollen Uhrzeit scrollen: jetzt (wenn heute sichtbar) oder 07:00.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const showsToday = days.some((d) => isSameDay(d, now))
    const hour = showsToday ? Math.min(Math.max(now.getHours() - 1, 6), 17) : 7
    el.scrollTop = hour * HOUR_PX
  }, [firstKey, days.length])

  const createAt = (day: Date, ev: MouseEvent<HTMLDivElement>) => {
    if (!onCreateAt) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const minutes = Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 2) * 30
    const clamped = Math.min(Math.max(minutes, 0), 23 * 60)
    onCreateAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(clamped / 60), clamped % 60))
  }

  const cols = `3.25rem repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {multi && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const today = isSameDay(d, now)
            return (
              <button
                key={d.getTime()}
                type="button"
                onClick={() => onPickDay?.(d)}
                className="flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-surface2"
                aria-label={`${formatWeekdayShort(d)} ${d.getDate()}. öffnen`}
              >
                <span className={`text-[11px] font-medium uppercase tracking-wide ${today ? 'text-accent' : 'text-muted'}`}>{formatWeekdayShort(d)}</span>
                <span className={`tnum flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${today ? 'bg-accent text-accentink' : ''}`}>
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {hasAllDay && (
        <div className="grid border-b border-line bg-surface2/50" style={{ gridTemplateColumns: cols }}>
          <div className="px-1 py-1.5 text-right text-[10px] leading-4 text-muted">ganzt.</div>
          {perDay.map((d) => (
            <div key={d.date.getTime()} className="min-w-0 space-y-1 border-l border-line p-1">
              {d.allDay.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  className={`${catClass(e.category)} flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${
                    e.kind === 'note' ? 'border border-dashed border-cat/60 text-ink' : e.kind === 'task' ? 'border border-cat/40 text-ink' : 'bg-cat/15 text-ink'
                  }`}
                >
                  {e.kind === 'note' && <Icon name="note" size={11} className="shrink-0 text-muted" />}
                  {e.kind === 'task' && <Icon name={e.done ? 'checkCircle' : 'circle'} size={11} className="shrink-0 text-muted" />}
                  <span className={`truncate ${e.done ? 'text-muted line-through' : ''}`}>{e.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="relative max-h-[calc(100dvh-15rem)] min-h-[22rem] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: DAY_PX }}>
          <div className="relative">
            {HOURS.map((h) => (
              <span key={h} className="tnum absolute right-2 -translate-y-1/2 text-[10px] text-muted" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {perDay.map(({ date, timed }) => {
            const blocks = layoutDay(timed, date, 0, 24)
            const overlaps = findOverlaps(timed)
            const today = isSameDay(date, now)
            const nowTop = ((now.getTime() - startOfDay(now).getTime()) / (addDays(startOfDay(now), 1).getTime() - startOfDay(now).getTime())) * DAY_PX
            return (
              <div
                key={date.getTime()}
                className={`relative border-l border-line ${onCreateAt ? 'cursor-cell' : ''} ${today && multi ? 'bg-accent/[0.03]' : ''}`}
                style={{ backgroundImage: 'linear-gradient(to bottom, rgb(var(--line)) 1px, transparent 1px)', backgroundSize: `100% ${HOUR_PX}px` }}
                onClick={(ev) => createAt(date, ev)}
              >
                {blocks.map((b) => {
                  const e = b.event
                  const height = Math.max(b.width * DAY_PX, 22)
                  const short = height < 40
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onOpen(e)
                      }}
                      className={`${catClass(e.category)} absolute flex flex-col justify-start overflow-hidden rounded-[6px] border-l-[3px] border-cat px-1.5 text-left text-ink transition-[filter] hover:brightness-95 dark:hover:brightness-125 ${
                        overlaps.has(e.id) ? 'ring-1 ring-danger/60' : ''
                      }`}
                      style={{
                        // Deckender Hintergrund mit Farbton, damit die Stundenlinien nicht durchscheinen
                        background: 'linear-gradient(rgb(var(--c) / 0.16), rgb(var(--c) / 0.16)), rgb(var(--surface))',
                        top: b.left * DAY_PX + 1,
                        height: height - 2,
                        left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / b.lanes}% - 4px)`,
                      }}
                      title={`${e.title}${overlaps.has(e.id) ? ' (überschneidet sich)' : ''}`}
                    >
                      <span className={`block truncate text-[11px] font-semibold leading-tight ${short ? 'pt-0.5' : 'pt-1'}`}>
                        {short && <span className="tnum mr-1 font-normal text-muted">{formatTime(e.start)}</span>}
                        <span className={e.done ? 'text-muted line-through' : ''}>{e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}</span>
                      </span>
                      {!short && (
                        <span className="tnum block truncate text-[10px] text-muted">
                          {formatTime(e.start)}
                          {e.end ? `–${formatTime(e.end)}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
                {today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-hidden="true">
                    <span className="-ml-1 h-2 w-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
