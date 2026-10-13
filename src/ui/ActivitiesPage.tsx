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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => onTemplate(t)}
                className={`${catClass(t.category)} group flex items-center gap-3 rounded-xl bg-cat/[0.09] px-3.5 py-3.5 text-left transition-colors hover:bg-cat/[0.16]`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cat text-surface transition-transform group-hover:scale-105">
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
          <section className="rounded-2xl bg-deep p-5 text-deepink">
            <h2 className="h-section mb-1 text-deepink">Regelmässig</h2>
            {seriesList.length === 0 ? (
              <p className="text-sm text-deepmuted">Noch keine Serien. Im Formular unter «Wiederholen» legst du eine an.</p>
            ) : (
              <ul className="-mx-2 mt-2">
                {seriesList.map((e) => (
                  <li key={e.ref!.id}>
                    <button type="button" onClick={() => onOpen(e)} className={`${evClass(e)} flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-deepink/10`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cat/25 text-deepink">
                        <Icon name="repeat" size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="tnum block text-xs text-deepmuted">
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

          <section className="rounded-2xl bg-surface p-5">
            <h2 className="h-section mb-3">Diese Woche geplant</h2>
            <PlanBars events={events} now={now} />
          </section>
        </aside>
      </div>
    </Page>
  )
}
