import { formatDuration, startOfWeek } from '../domain/dateUtils'
import type { CalendarEvent } from '../domain/types'
import { categoryMinutes, summarizeWeek } from '../domain/weekLayout'
import { CATEGORIES, CATEGORY_LABEL, catClass } from './kit'

/** Geplante Zeit pro Kategorie in dieser Woche (nur Einträge mit bekannter Dauer). */
export default function PlanBars({ events, now, compact = false }: { events: CalendarEvent[]; now: Date; compact?: boolean }) {
  const totals = categoryMinutes(summarizeWeek(events, startOfWeek(now)))
  const max = Math.max(...CATEGORIES.map((c) => totals[c]), 60)
  const sum = CATEGORIES.reduce((s, c) => s + totals[c], 0)
  return (
    <div>
      <ul className={compact ? 'space-y-2' : 'space-y-3'}>
        {CATEGORIES.map((c) => (
          <li key={c} className={`${catClass(c)} grid grid-cols-[5.5rem,1fr,3.5rem] items-center gap-3 text-sm`}>
            <span className="text-muted">{CATEGORY_LABEL[c]}</span>
            <span className="h-1.5 overflow-hidden bg-surface2">
              <span className="block h-full bg-cat transition-[width]" style={{ width: `${(totals[c] / max) * 100}%` }} />
            </span>
            <span className="tnum text-right text-xs">{totals[c] > 0 ? formatDuration(totals[c]) : '–'}</span>
          </li>
        ))}
      </ul>
      <p className="tnum mt-2 text-xs text-muted">{sum > 0 ? `Zusammen ${formatDuration(sum)} geplant, Montag bis Sonntag.` : 'Für diese Woche ist noch nichts mit Dauer geplant.'}</p>
    </div>
  )
}
