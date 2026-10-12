import {
  formatCountdown,
  formatDateLong,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
  isoWeek,
  isSameDay,
  startOfDay,
} from '../domain/dateUtils'
import { nextEvent } from '../domain/schedule'
import type { CalendarEvent } from '../domain/types'
import DayTimeline from './DayTimeline'

interface Props {
  events: CalendarEvent[]
  now: Date
  loading: boolean
}

export default function TodayView({ events, now, loading }: Props) {
  const next = nextEvent(events, now)

  return (
    <div>
      <header className="border-b border-ink px-5 pb-5 pt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">
          NiFlow · Kalenderwoche {isoWeek(now)}
        </p>
        <h1 className="mt-1 text-4xl font-bold leading-none tracking-tight">{formatWeekday(now)}</h1>
        <p className="mt-2 text-base text-ink/70">{formatDateLong(now)}</p>
      </header>

      <NextEventBanner next={next} now={now} />

      <DayTimeline events={events} date={startOfDay(now)} now={now} loading={loading} />
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
