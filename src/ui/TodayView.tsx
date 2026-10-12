import {
  formatCountdown,
  formatDateLong,
  formatDuration,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
  isoWeek,
  isSameDay,
  minutesBetween,
  startOfDay,
} from '../domain/dateUtils'
import {
  busyMinutes,
  deadlineUrgency,
  effectiveEnd,
  eventsForDay,
  findFreeSlots,
  findOverlaps,
  isHeavyDay,
  nextEvent,
} from '../domain/schedule'
import type { FreeSlot } from '../domain/schedule'
import { CATEGORY_LABEL, SOURCE_LABEL } from '../domain/types'
import type { CalendarEvent } from '../domain/types'
import { CATEGORY_STYLE } from './categoryStyle'

interface Props {
  events: CalendarEvent[]
  now: Date
  loading: boolean
}

type Row =
  | { type: 'now'; at: Date }
  | { type: 'free'; at: Date; slot: FreeSlot }
  | { type: 'event'; at: Date; event: CalendarEvent }

const PRIORITY = { now: 0, free: 1, event: 2 } as const

export default function TodayView({ events, now, loading }: Props) {
  const today = startOfDay(now)
  const day = eventsForDay(events, today)
  const overlaps = findOverlaps(day.timed)
  const busy = busyMinutes(day.timed, today)
  const heavy = isHeavyDay(busy)
  const next = nextEvent(events, now)

  const nowRow: Row = { type: 'now', at: now }
  const rows: Row[] = [
    ...day.timed.map((event): Row => ({ type: 'event', at: event.start, event })),
    ...findFreeSlots(day, today, now).map((slot): Row => ({ type: 'free', at: slot.start, slot })),
    nowRow,
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || PRIORITY[a.type] - PRIORITY[b.type])

  const isEmpty = day.timed.length === 0 && day.allDay.length === 0

  return (
    <div>
      <header className="border-b border-ink px-5 pb-5 pt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">
          Kalenderwoche {isoWeek(now)}
        </p>
        <h1 className="mt-1 text-4xl font-bold leading-none tracking-tight">{formatWeekday(now)}</h1>
        <p className="mt-2 text-base text-ink/70">{formatDateLong(now)}</p>
      </header>

      <NextEventBanner next={next} now={now} />

      {(overlaps.size > 0 || heavy) && (
        <div role="status" className="space-y-1 border-b border-ink/20 bg-signal/10 px-5 py-3 text-sm">
          {overlaps.size > 0 && (
            <p>
              <strong className="font-semibold text-signal">Überschneidung:</strong>{' '}
              {overlaps.size} Termine liegen zeitlich übereinander.
            </p>
          )}
          {heavy && (
            <p>
              <strong className="font-semibold text-signal">Stark belegter Tag:</strong>{' '}
              <span className="time">{formatDuration(busy)}</span> geplant.
            </p>
          )}
        </div>
      )}

      {day.allDay.length > 0 && (
        <section aria-label="Ganztägig" className="border-b border-ink/20 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-widest text-ink/60">Ganztägig</p>
          <ul className="mt-2 space-y-1">
            {day.allDay.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <span className={`h-3 w-1 ${CATEGORY_STYLE[e.category].bar}`} />
                <span className="font-medium">{e.title}</span>
                <span className="text-ink/50">
                  {CATEGORY_LABEL[e.category]} · {SOURCE_LABEL[e.source]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink/60">
            Freie Zeit ist an diesem Tag nicht sicher, solange ein ganztägiger Termin besteht.
          </p>
        </section>
      )}

      {loading && events.length === 0 ? (
        <p className="px-5 py-10 text-sm text-ink/60">Termine werden geladen …</p>
      ) : isEmpty ? (
        <EmptyDay />
      ) : (
        <ol aria-label="Zeitleiste des Tages">
          {rows.map((row) => {
            switch (row.type) {
              case 'now':
                return <NowLine key="now" at={row.at} />
              case 'free':
                return <FreeRow key={`free-${row.at.getTime()}`} slot={row.slot} />
              case 'event':
                return (
                  <EventRow
                    key={row.event.id}
                    event={row.event}
                    now={now}
                    conflicts={overlaps.get(row.event.id) ?? []}
                  />
                )
            }
          })}
        </ol>
      )}
    </div>
  )
}

function NextEventBanner({ next, now }: { next: CalendarEvent | null; now: Date }) {
  if (!next) {
    return (
      <section className="border-b border-ink/20 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">Als Nächstes</p>
        <p className="mt-1 text-base text-ink/70">Kein weiterer Termin bekannt.</p>
      </section>
    )
  }
  const sameDay = isSameDay(next.start, now)
  return (
    <section className="flex items-end justify-between gap-4 border-b border-ink/20 px-5 py-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">Als Nächstes</p>
        <p className="mt-1 truncate text-lg font-semibold">{next.title}</p>
        <p className="time text-sm text-ink/70">
          {sameDay ? '' : `${formatWeekdayShort(next.start)} `}
          {formatTime(next.start)} Uhr
        </p>
      </div>
      <p className="time shrink-0 text-right text-xl font-semibold text-signal">
        {formatCountdown(now, next.start)}
      </p>
    </section>
  )
}

function EmptyDay() {
  return (
    <div className="px-5 py-12">
      <p className="text-xl font-semibold">Heute ist nichts geplant.</p>
      <p className="mt-2 text-sm text-ink/60">
        Für diesen Tag sind keine Termine bekannt. Das gilt nur für die verbundenen Quellen.
      </p>
    </div>
  )
}

function NowLine({ at }: { at: Date }) {
  return (
    <li aria-label="Aktuelle Uhrzeit" className="flex items-center gap-3 px-5 py-1">
      <span className="time w-12 shrink-0 text-sm font-semibold text-signal">{formatTime(at)}</span>
      <span className="h-px flex-1 bg-signal" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-signal">Jetzt</span>
    </li>
  )
}

function FreeRow({ slot }: { slot: FreeSlot }) {
  return (
    <li className="flex gap-3 border-b border-dashed border-ink/20 px-5 py-3">
      <span className="time w-12 shrink-0 text-sm text-ink/50">{formatTime(slot.start)}</span>
      <div className="min-w-0 flex-1 border-l border-dashed border-ink/30 pl-3">
        <p className="text-sm text-ink/60">
          Frei, <span className="time">{formatDuration(slot.minutes)}</span>{' '}
          <span className="time text-ink/40">bis {formatTime(slot.end)}</span>
        </p>
        {slot.uncertain ? (
          <p className="mt-0.5 text-xs text-ink/50">Nicht sicher frei (ganztägiger Termin)</p>
        ) : slot.study ? (
          <p className="mt-0.5 text-xs text-study">
            Geeignet für einen Lernblock:{' '}
            <span className="time">
              {formatTime(slot.study.start)}–{formatTime(slot.study.end)}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  )
}

function EventRow({
  event,
  now,
  conflicts,
}: {
  event: CalendarEvent
  now: Date
  conflicts: CalendarEvent[]
}) {
  const past = (event.end ?? event.start) <= now
  const running = event.start <= now && effectiveEnd(event) > now && event.end !== null
  const urgency = deadlineUrgency(event, now)
  const style = CATEGORY_STYLE[event.category]

  const duration = event.end
    ? formatDuration(minutesBetween(event.start, event.end))
    : event.kind === 'event'
      ? 'Dauer unbekannt'
      : 'Frist'
  const kindLabel = event.kind === 'exam' ? 'Prüfung' : event.kind === 'deadline' ? 'Abgabe' : null

  return (
    <li className={`flex gap-3 border-b border-ink/20 px-5 py-4 ${past ? 'opacity-50' : ''}`}>
      <div className="time w-12 shrink-0 text-sm leading-snug">
        <p className="font-semibold">{formatTime(event.start)}</p>
        <p className="text-ink/50">{event.end ? formatTime(event.end) : '–'}</p>
      </div>
      <span className={`w-1 shrink-0 ${style.bar}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug">{event.title}</p>
        <p className="mt-0.5 text-sm text-ink/60">
          <span className={style.text}>{CATEGORY_LABEL[event.category]}</span>
          {kindLabel && ` · ${kindLabel}`} · {SOURCE_LABEL[event.source]} ·{' '}
          <span className="time">{duration}</span>
        </p>
        {(running || urgency || conflicts.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
            {running && <span className="border border-ink px-1.5 py-0.5">Läuft</span>}
            {urgency === 'h3' && (
              <span className="bg-signal px-1.5 py-0.5 text-paper">Weniger als 3 h</span>
            )}
            {urgency === 'h48' && (
              <span className="border border-signal px-1.5 py-0.5 text-signal">Innerhalb 48 h</span>
            )}
            {conflicts.length > 0 && (
              <span className="border border-signal px-1.5 py-0.5 text-signal">
                Überschneidung mit {conflicts.map((c) => c.title).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
