import { useState } from 'react'
import {
  addDays,
  atTime,
  formatDayMonth,
  formatDuration,
  formatWeekday,
  formatWeekdayShort,
  isoWeek,
  isSameDay,
  startOfDay,
  startOfWeek,
} from '../domain/dateUtils'
import { CATEGORY_LABEL } from '../domain/types'
import type { CalendarEvent, Category } from '../domain/types'
import { GRID, categoryMinutes, summarizeWeek } from '../domain/weekLayout'
import type { DaySummary } from '../domain/weekLayout'
import { CATEGORY_STYLE } from './categoryStyle'
import DayTimeline from './DayTimeline'

interface Props {
  events: CalendarEvent[]
  now: Date
  loading: boolean
}

const TICKS = [6, 9, 12, 15, 18, 21]
const CATEGORIES: Category[] = ['training', 'work', 'study', 'private']

/** Position einer Uhrzeit im Raster in Prozent. */
const pct = (hour: number) => ((hour - GRID.startHour) / (GRID.endHour - GRID.startHour)) * 100

export default function WeekView({ events, now, loading }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [selected, setSelected] = useState(() => startOfDay(now))

  const summaries = summarizeWeek(events, weekStart)
  const totals = categoryMinutes(summaries)
  const weekEnd = addDays(weekStart, 6)
  const overlapDays = summaries.filter((d) => d.overlapIds.size > 0)
  const heavyDays = summaries.filter((d) => d.heavy)

  const shiftWeeks = (weeks: number) => {
    setWeekStart((w) => addDays(w, weeks * 7))
    setSelected((s) => addDays(s, weeks * 7))
  }
  const goToday = () => {
    setWeekStart(startOfWeek(now))
    setSelected(startOfDay(now))
  }

  return (
    <div>
      <header className="border-b border-ink px-5 pb-4 pt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">NiFlow · Woche</p>
        <h1 className="mt-1 text-4xl font-bold leading-none tracking-tight">
          KW {isoWeek(weekStart)}
        </h1>
        <p className="time mt-2 text-base text-ink/70">
          {formatDayMonth(weekStart)} – {formatDayMonth(weekEnd)} {weekEnd.getFullYear()}
        </p>
      </header>

      <nav aria-label="Woche wechseln" className="flex border-b border-ink/20">
        <button
          type="button"
          onClick={() => shiftWeeks(-1)}
          aria-label="Vorherige Woche"
          className="flex min-h-12 w-14 items-center justify-center border-r border-ink/20"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goToday}
          className="min-h-12 flex-1 text-sm font-medium uppercase tracking-wider"
        >
          Heute
        </button>
        <button
          type="button"
          onClick={() => shiftWeeks(1)}
          aria-label="Nächste Woche"
          className="flex min-h-12 w-14 items-center justify-center border-l border-ink/20"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </nav>

      {(overlapDays.length > 0 || heavyDays.length > 0) && (
        <div role="status" className="space-y-1 border-b border-ink/20 bg-signal/10 px-5 py-3 text-sm">
          {overlapDays.length > 0 && (
            <p>
              <strong className="font-semibold text-signal">Überschneidungen:</strong>{' '}
              {overlapDays.map((d) => formatWeekdayShort(d.date)).join(', ')}
            </p>
          )}
          {heavyDays.length > 0 && (
            <p>
              <strong className="font-semibold text-signal">Stark belegt (über 10 h):</strong>{' '}
              {heavyDays.map((d) => formatWeekdayShort(d.date)).join(', ')}
            </p>
          )}
        </div>
      )}

      <section aria-label="Geplante Zeit pro Kategorie" className="border-b border-ink/20 px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">
          Geplant in dieser Woche
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {CATEGORIES.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 ${CATEGORY_STYLE[c].bar}`} aria-hidden="true" />
              <span className="flex-1">{CATEGORY_LABEL[c]}</span>
              <span className="time text-ink/70">{totals[c] > 0 ? formatDuration(totals[c]) : '–'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink/50">Nur Termine mit bekannter Dauer.</p>
      </section>

      <section aria-label="Wochenraster" className="py-3">
        <div className="relative mb-1 ml-[68px] mr-[84px] h-4" aria-hidden="true">
          {TICKS.map((h) => (
            <span
              key={h}
              className="time absolute -translate-x-1/2 text-[11px] text-ink/50"
              style={{ left: `${pct(h)}%` }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        <ul>
          {summaries.map((day) => (
            <li key={day.date.getTime()}>
              <DayRow
                day={day}
                now={now}
                selected={isSameDay(day.date, selected)}
                onSelect={() => setSelected(day.date)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Tagesdetails" className="border-t border-ink">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink/20 px-5 py-3">
          <h2 className="text-xl font-bold">
            {formatWeekday(selected)}, {formatDayMonth(selected)}
          </h2>
          {isSameDay(selected, now) && (
            <span className="text-xs font-semibold uppercase tracking-wider text-signal">Heute</span>
          )}
        </div>
        <DayTimeline events={events} date={selected} now={now} loading={loading} />
      </section>
    </div>
  )
}

function DayRow({
  day,
  now,
  selected,
  onSelect,
}: {
  day: DaySummary
  now: Date
  selected: boolean
  onSelect: () => void
}) {
  const today = isSameDay(day.date, now)
  const past = startOfDay(day.date) < startOfDay(now)
  const ws = atTime(day.date, GRID.startHour).getTime()
  const we = atTime(day.date, GRID.endHour).getTime()
  const nowFrac = (now.getTime() - ws) / (we - ws)

  const label =
    `${formatWeekday(day.date)} ${formatDayMonth(day.date)}, ` +
    (day.busy > 0 ? `${formatDuration(day.busy)} belegt` : 'nichts geplant') +
    (day.overlapIds.size > 0 ? ', Überschneidung' : '') +
    (day.heavy ? ', stark belegt' : '')

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className={`flex min-h-12 w-full items-center gap-2 px-5 ${selected ? 'bg-ink/[0.06]' : ''} ${
        past ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center leading-none ${
          selected ? 'bg-ink text-paper' : today ? 'text-signal' : ''
        }`}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {formatWeekdayShort(day.date)}
        </span>
        <span className="time mt-0.5 text-sm font-semibold">{day.date.getDate()}</span>
      </span>

      <span className="relative h-9 flex-1 bg-ink/[0.04]" aria-hidden="true">
        {TICKS.map((h) => (
          <span key={h} className="absolute inset-y-0 w-px bg-ink/10" style={{ left: `${pct(h)}%` }} />
        ))}
        {day.allDay.map((e) => (
          <span
            key={e.id}
            className={`absolute inset-x-0 top-0 h-[3px] ${CATEGORY_STYLE[e.category].bar}`}
          />
        ))}
        {day.blocks.map((b) => (
          <span
            key={b.event.id}
            className={`absolute border border-paper ${CATEGORY_STYLE[b.event.category].bar}`}
            style={{
              left: `${b.left * 100}%`,
              width: `${b.width * 100}%`,
              top: `${(b.lane / b.lanes) * 100}%`,
              height: `${100 / b.lanes}%`,
            }}
          />
        ))}
        {today && nowFrac >= 0 && nowFrac <= 1 && (
          <span
            className="absolute -inset-y-[3px] w-0.5 bg-signal"
            style={{ left: `${nowFrac * 100}%` }}
          />
        )}
      </span>

      <span
        className={`time w-14 shrink-0 text-right text-[11px] ${
          day.heavy ? 'font-semibold text-signal' : 'text-ink/60'
        }`}
      >
        {day.overlapIds.size > 0 && <span className="mr-0.5 font-semibold text-signal">!</span>}
        {day.busy > 0 ? formatDuration(day.busy) : '–'}
      </span>
    </button>
  )
}
