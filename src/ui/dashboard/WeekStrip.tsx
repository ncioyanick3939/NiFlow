import { addDays, formatDuration, isSameDay, startOfDay, startOfWeek } from '../../domain/dateUtils'
import type { CalendarEvent, Category } from '../../domain/types'
import { summarizeWeek } from '../../domain/weekLayout'
import { CATEGORIES, CATEGORY_LABEL, catClass } from '../kit'

const SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Woche als sieben Säulen: geplante Zeit pro Tag nach Kategorie (nur Einträge mit Dauer). */
export default function WeekStrip({ events, now, onPickDay }: { events: CalendarEvent[]; now: Date; onPickDay: (d: Date) => void }) {
  const days = summarizeWeek(events, startOfWeek(now)).map((d) => {
    const from = startOfDay(d.date).getTime()
    const to = addDays(startOfDay(d.date), 1).getTime()
    const per: Record<Category, number> = { training: 0, work: 0, study: 0, private: 0 }
    for (const e of d.timed) {
      if (!e.end || e.kind === 'task') continue
      const a = Math.max(e.start.getTime(), from)
      const b = Math.min(e.end.getTime(), to)
      if (b > a) per[e.category] += (b - a) / 60000
    }
    return { ...d, per }
  })
  const max = Math.max(...days.map((d) => d.busy), 8 * 60)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {days.map((d, i) => {
          const today = isSameDay(d.date, now)
          return (
            <button
              key={d.date.getTime()}
              type="button"
              onClick={() => onPickDay(d.date)}
              className={`group flex min-w-0 flex-col items-center gap-2 border-t-2 px-0.5 pb-2 pt-3 transition-colors duration-150 hover:bg-surface2/60 ${today ? 'border-accent' : 'border-transparent'}`}
              aria-label={`${SHORT[i]} ${d.date.getDate()}: ${d.busy > 0 ? formatDuration(d.busy) : 'nichts'} geplant`}
            >
              <span className="flex h-24 w-full max-w-[28px] flex-col-reverse overflow-hidden bg-surface2 group-hover:bg-line/60 sm:h-28">
                {CATEGORIES.map((c) =>
                  d.per[c] > 0 ? <span key={c} className={`${catClass(c)} block w-full bg-cat`} style={{ height: `${(d.per[c] / max) * 100}%` }} /> : null,
                )}
              </span>
              <span className={`text-xs font-semibold ${today ? 'text-accent' : 'text-muted'}`}>{SHORT[i]}</span>
              <span className={`tnum truncate text-[11px] ${d.heavy ? 'font-semibold text-ink' : 'text-muted'}`} title={d.heavy ? 'Viel verplant' : undefined}>
                {d.busy > 0 ? `${Math.round(d.busy / 6) / 10} h` : '–'}
              </span>
              {d.heavy && <span className="-mt-1.5 text-[10px] text-muted">voll</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {CATEGORIES.map((c) => (
          <span key={c} className={`${catClass(c)} inline-flex items-center gap-1.5`}>
            <span className="h-2 w-2 bg-cat" aria-hidden="true" />
            {CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>
    </div>
  )
}
