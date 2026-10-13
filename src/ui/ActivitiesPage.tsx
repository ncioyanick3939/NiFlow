import { addDays, formatTime, startOfDay } from '../domain/dateUtils'
import { evClass } from './labels'
import { RECURRENCE_LABEL } from '../domain/recurrence'
import type { CalendarEvent, Category } from '../domain/types'
import AgendaView from './calendar/AgendaView'
import Icon from './icons'
import type { IconName } from './icons'
import { catClass } from './kit'
import Page from './Page'
import PlanBars from './PlanBars'

export interface ActivityTemplate {
  label: string
  title: string
  category: Category
  minutes: number
  icon: IconName
}

/** Vorlagen für schnelles Anlegen. Alles bleibt im Formular änderbar. */
export const TEMPLATES: ActivityTemplate[] = [
  { label: 'Lernen', title: 'Lernen', category: 'study', minutes: 90, icon: 'exam' },
  { label: 'Vorlesung', title: 'Vorlesung', category: 'study', minutes: 90, icon: 'layers' },
  { label: 'Arbeit', title: 'Arbeit', category: 'work', minutes: 240, icon: 'monitor' },
  { label: 'Sport', title: 'Training', category: 'training', minutes: 60, icon: 'dumbbell' },
  { label: 'Projekt', title: 'Projekt', category: 'work', minutes: 120, icon: 'flag' },
  { label: 'Erledigung', title: 'Erledigung', category: 'private', minutes: 30, icon: 'check' },
  { label: 'Persönlich', title: 'Termin', category: 'private', minutes: 60, icon: 'calendar' },
  { label: 'Freizeit', title: 'Freizeit', category: 'private', minutes: 120, icon: 'sun' },
]

interface Props {
  events: CalendarEvent[]
  now: Date
  readOnly: boolean
  onOpen: (e: CalendarEvent) => void
  onTemplate: (t: ActivityTemplate) => void
}

const WEEKDAY = new Intl.DateTimeFormat('de-CH', { weekday: 'long' })

/** Eigene Aktivitäten: Vorlagen, regelmässige Serien, Wochenplanung und die nächsten zwei Wochen. */
export default function ActivitiesPage({ events, now, readOnly, onOpen, onTemplate }: Props) {
  // Eigene Termine (im Demo-Modus die Beispieltermine)
  const own = events.filter((e) => ((e.source === 'own' && e.ref?.type === 'entry') || e.source === 'test') && e.kind !== 'note')
  // Serien: ein Eintrag pro Serie, das nächste Vorkommen
  const series = new Map<string, CalendarEvent>()
  for (const e of own) {
    if (!e.recurrence || e.recurrence === 'none' || !e.ref) continue
    const prev = series.get(e.ref!.id)
    const upcoming = (e.end ?? e.start) >= now
    if (!prev || (upcoming && (prev.end ?? prev.start) < now) || (upcoming && e.start < prev.start)) series.set(e.ref!.id, e)
  }
  const upcoming = own.filter((e) => e.start >= startOfDay(now) && e.start < addDays(startOfDay(now), 14))

  const seriesList = [...series.values()].sort((a, b) => ((a.start.getDay() + 6) % 7) - ((b.start.getDay() + 6) % 7) || a.start.getHours() - b.start.getHours())

  return (
    <Page title="Aktivitäten" sub={`${upcoming.length} in den nächsten zwei Wochen, ${series.size} regelmässig`}>
      {!readOnly && (
        <section className="mb-8" aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="h-section mb-3">Schnell anlegen</h2>
          <div className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => onTemplate(t)}
                className={`${catClass(t.category)} group flex min-h-16 items-center gap-3 border-b border-r border-line px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface2/60`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cat/15 text-cat">
                  <Icon name={t.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.label}</span>
                  <span className="tnum block text-xs text-muted">{t.minutes < 60 ? `${t.minutes} min` : `${t.minutes / 60} h`}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-8">
          <h2 className="h-section mb-3">Nächste zwei Wochen</h2>
          <AgendaView from={now} days={14} events={upcoming} now={now} onOpen={onOpen} />
        </section>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <section className="rule">
            <h2 className="h-section mb-1">Regelmässig</h2>
            {seriesList.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Serien. Im Formular unter «Wiederholen» legst du eine an.</p>
            ) : (
              <ul className="divide-y divide-line">
                {seriesList.map((e) => (
                  <li key={e.ref!.id}>
                    <button type="button" onClick={() => onOpen(e)} className={`${evClass(e)} flex min-h-12 w-full items-center gap-3 py-2 text-left transition-colors duration-150 hover:bg-surface2/50`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-cat">
                        <Icon name="repeat" size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="tnum block text-xs text-muted">
                          {RECURRENCE_LABEL[e.recurrence!]}
                          {e.recurrence === 'weekly' || e.recurrence === 'biweekly' ? `, ${WEEKDAY.format(e.start)}` : ''}
                          {e.allDay ? '' : `, ${formatTime(e.start)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rule">
            <h2 className="h-section mb-3">Diese Woche geplant</h2>
            <PlanBars events={events} now={now} />
          </section>
        </aside>
      </div>
    </Page>
  )
}
