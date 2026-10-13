import { addDays, formatTime, startOfDay } from '../domain/dateUtils'
import { RECURRENCE_LABEL } from '../domain/recurrence'
import type { CalendarEvent, Category } from '../domain/types'
import AgendaView from './calendar/AgendaView'
import Icon from './icons'
import type { IconName } from './icons'
import { CategoryDot, catClass } from './kit'
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

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
      <h1 className="mb-6 h-display text-[28px] leading-tight md:text-[34px]">Aktivitäten</h1>

      {!readOnly && (
        <section className="mb-8">
          <h2 className="eyebrow mb-2">Neu aus Vorlage</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => onTemplate(t)}
                className={`${catClass(t.category)} flex items-center gap-3 rounded-xl bg-surface px-3 py-3 text-left transition-colors hover:border-cat hover:bg-cat/[0.06]`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cat/15 text-cat">
                  <Icon name={t.icon} size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="tnum block text-xs text-muted">{t.minutes < 60 ? `${t.minutes} min` : `${t.minutes / 60} h`}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),20rem]">
        <section className="min-w-0">
          <h2 className="h-section mb-3">Nächste zwei Wochen</h2>
          <AgendaView from={now} days={14} events={upcoming} now={now} onOpen={onOpen} />
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="h-section mb-3">Diese Woche geplant</h2>
            <PlanBars events={events} now={now} />
          </section>

          <section>
            <h2 className="h-section mb-2">Regelmässig</h2>
            {series.size === 0 ? (
              <p className="text-sm text-muted">Noch keine wiederkehrenden Aktivitäten. Im Formular unter «Wiederholen» legst du eine Serie an.</p>
            ) : (
              <ul className="space-y-1">
                {[...series.values()]
                  .sort((a, b) => a.start.getDay() - b.start.getDay() || a.start.getHours() - b.start.getHours())
                  .map((e) => (
                    <li key={e.ref!.id}>
                      <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface2">
                        <Icon name="repeat" size={15} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 truncate text-sm font-medium">
                            <CategoryDot category={e.category} /> {e.title}
                          </span>
                          <span className="tnum block text-xs text-muted">
                            {RECURRENCE_LABEL[e.recurrence!]}
                            {e.recurrence === 'weekly' || e.recurrence === 'biweekly'
                              ? ` · ${new Intl.DateTimeFormat('de-CH', { weekday: 'long' }).format(e.start)}`
                              : ''}
                            {e.allDay ? '' : ` · ${formatTime(e.start)}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
