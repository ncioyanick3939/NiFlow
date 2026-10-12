import { addDays, formatDuration, formatTime, isoWeek, minutesBetween, startOfDay, startOfWeek } from '../domain/dateUtils'
import type { CalendarEvent } from '../domain/types'
import type { SourceState } from '../sources/types'
import Icon, { sportIcon } from './icons'
import { EmptyState } from './kit'

interface Props {
  events: CalendarEvent[]
  states: SourceState[]
  now: Date
  demo: boolean
  onOpen: (e: CalendarEvent) => void
  onGoSettings: () => void
}

const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })

function minutesOf(e: CalendarEvent): number | null {
  if (e.plannedMinutes) return e.plannedMinutes
  if (!e.allDay && e.end) return minutesBetween(e.start, e.end)
  return null
}

/** Geplante Trainings aus Intervals.icu, nach Wochen gruppiert. Nur lesend. */
export default function TrainingPage({ events, states, now, demo, onOpen, onGoSettings }: Props) {
  const state = states.find((s) => s.id === 'intervals')
  const thisWeek = startOfWeek(now)
  const items = events
    .filter((e) => e.source === 'intervals' && e.start >= thisWeek)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const weeks = new Map<number, CalendarEvent[]>()
  for (const e of items) {
    const key = startOfWeek(e.start).getTime()
    weeks.set(key, [...(weeks.get(key) ?? []), e])
  }
  const current = weeks.get(thisWeek.getTime()) ?? []
  const totalMin = current.reduce((sum, e) => sum + (minutesOf(e) ?? 0), 0)
  const bySport = new Map<string, number>()
  for (const e of current) {
    const k = sportIcon(e.sport)
    bySport.set(k, (bySport.get(k) ?? 0) + (minutesOf(e) ?? 0))
  }
  const sportName: Record<string, string> = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', dumbbell: 'Weiteres' }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Icon name="activity" size={14} /> Intervals.icu · importiert, nur lesen
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight">Training</h1>
      </header>

      {state?.status === 'error' && (
        <p className="mb-6 flex items-start gap-3 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-sm" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" />
          {state.error}
        </p>
      )}

      {!state && (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon="activity"
            title={demo ? 'Im Demo-Modus nicht verfügbar' : 'Intervals.icu ist noch nicht verbunden'}
            text={demo ? 'Melde dich an und hinterlege deinen Intervals.icu-Schlüssel, um geplante Trainings zu sehen.' : 'Hinterlege deinen API-Schlüssel in den Einstellungen. Danach erscheinen geplante Trainings hier und im Kalender.'}
            action={!demo && <button type="button" className="btn-primary" onClick={onGoSettings}>Zu den Einstellungen</button>}
          />
        </div>
      )}

      {state && (
        <>
          <section className="mb-8 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface">
            <Stat label="Einheiten diese Woche" value={String(current.length)} />
            <Stat label="Geplante Zeit" value={totalMin > 0 ? formatDuration(totalMin) : '–'} />
            <Stat label="Intensiv" value={String(current.filter((e) => e.intensity === 'high').length)} />
          </section>

          {bySport.size > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              {[...bySport.entries()].map(([k, m]) => (
                <span key={k} className="cat-training inline-flex items-center gap-2 rounded-full bg-cat/10 px-3 py-1.5 text-sm">
                  <Icon name={k as Parameters<typeof Icon>[0]['name']} size={16} className="text-cat" />
                  {sportName[k]}
                  <span className="tnum text-muted">{m > 0 ? formatDuration(m) : ''}</span>
                </span>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState icon="activity" title="Keine geplanten Trainings" text="In Intervals.icu sind für diese und die nächsten Wochen keine Trainings eingetragen." />
            </div>
          ) : (
            <div className="space-y-8">
              {[...weeks.entries()].map(([key, list]) => {
                const start = new Date(key)
                const label =
                  key === thisWeek.getTime() ? 'Diese Woche' : key === addDays(thisWeek, 7).getTime() ? 'Nächste Woche' : `KW ${isoWeek(start)}`
                const sum = list.reduce((s, e) => s + (minutesOf(e) ?? 0), 0)
                return (
                  <section key={key}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h2 className="text-base font-semibold">{label}</h2>
                      <span className="tnum text-sm text-muted">{sum > 0 ? formatDuration(sum) : ''}</span>
                    </div>
                    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                      {list.map((e) => {
                        const min = minutesOf(e)
                        const past = startOfDay(e.start) < startOfDay(now)
                        return (
                          <li key={e.id}>
                            <button type="button" onClick={() => onOpen(e)} className={`cat-training flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface2 ${past ? 'opacity-55' : ''}`}>
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cat/15 text-cat">
                                <Icon name={sportIcon(e.sport)} size={20} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{e.title}</span>
                                <span className="tnum block text-xs text-muted">
                                  {fmtDay.format(e.start).replace(/\./g, '')}
                                  {e.allDay ? ' · ohne Uhrzeit' : ` · ${formatTime(e.start)}`}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="tnum text-sm font-medium">{min ? formatDuration(min) : '–'}</span>
                                {e.intensity === 'high' && <span className="rounded-sm bg-danger/10 px-1.5 py-px text-[10px] font-semibold uppercase text-danger">Intensiv</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
          <p className="mt-6 text-xs text-muted">
            Es werden geplante Trainings und Wettkämpfe angezeigt. Absolvierte Aktivitäten folgen in einer späteren Runde.
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4">
      <p className="tnum text-xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  )
}
