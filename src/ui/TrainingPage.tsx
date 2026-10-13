import { addDays, formatDuration, formatTime, isSameDay, isoWeek, minutesBetween, startOfDay, startOfWeek } from '../domain/dateUtils'
import type { CalendarEvent } from '../domain/types'
import type { SourceState } from '../sources/types'
import Icon, { sportIcon } from './icons'
import type { IconName } from './icons'
import { EmptyState } from './kit'
import Page from './Page'

interface Props {
  events: CalendarEvent[]
  states: SourceState[]
  now: Date
  demo: boolean
  onOpen: (e: CalendarEvent) => void
  onGoSettings: () => void
}

const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })
const SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const SPORT_NAME: Record<string, string> = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', dumbbell: 'Weiteres' }

function minutesOf(e: CalendarEvent): number {
  if (e.plannedMinutes) return e.plannedMinutes
  if (!e.allDay && e.end) return minutesBetween(e.start, e.end)
  return 0
}

/**
 * Training aus Intervals.icu (nur lesend):
 * oben die laufende Woche als dunkler Bereich (geplant gegen absolviert, Tag für Tag),
 * darunter die Einheiten nach Wochen, rechts die nächste Einheit und die Sportarten.
 */
export default function TrainingPage({ events, states, now, demo, onOpen, onGoSettings }: Props) {
  const state = states.find((s) => s.id === 'intervals')
  const thisWeek = startOfWeek(now)
  const items = events
    .filter((e) => e.source === 'intervals' && e.start >= (e.completed ? addDays(thisWeek, -7) : thisWeek))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const weeks = new Map<number, CalendarEvent[]>()
  for (const e of items) {
    const key = startOfWeek(e.start).getTime()
    weeks.set(key, [...(weeks.get(key) ?? []), e])
  }
  const current = weeks.get(thisWeek.getTime()) ?? []
  const planned = current.filter((e) => !e.completed)
  const done = current.filter((e) => e.completed)
  const plannedMin = planned.reduce((s, e) => s + minutesOf(e), 0)
  const doneMin = done.reduce((s, e) => s + minutesOf(e), 0)
  const load = done.reduce((s, e) => s + (e.load ?? 0), 0)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(thisWeek, i)
    const list = current.filter((e) => isSameDay(e.start, d))
    return { d, p: list.filter((e) => !e.completed).reduce((s, e) => s + minutesOf(e), 0), c: list.filter((e) => e.completed).reduce((s, e) => s + minutesOf(e), 0) }
  })
  const dayMax = Math.max(...perDay.map((x) => Math.max(x.p, x.c)), 60)
  const bySport = new Map<IconName, number>()
  for (const e of planned) bySport.set(sportIcon(e.sport), (bySport.get(sportIcon(e.sport)) ?? 0) + minutesOf(e))
  const next = items.find((e) => !e.completed && e.start >= startOfDay(now))

  return (
    <Page title="Training" sub="Aus Intervals.icu, nur lesend">
      {state?.status === 'error' && (
        <p className="mb-6 flex items-start gap-3 border-l-2 border-danger bg-surface px-4 py-3 text-sm" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" />
          {state.error}
        </p>
      )}

      {!state ? (
        <div className="rounded border border-line bg-surface">
          <EmptyState
            icon="activity"
            title={demo ? 'Im Demo-Modus nicht verfügbar' : 'Intervals.icu ist noch nicht verbunden'}
            text={demo ? 'Melde dich an und hinterlege deinen Intervals.icu-Schlüssel, um deine Trainings zu sehen.' : 'Hinterlege deinen API-Schlüssel in den Einstellungen. Danach erscheinen geplante und absolvierte Trainings hier und im Kalender.'}
            action={!demo && <button type="button" className="btn-primary" onClick={onGoSettings}>Zu den Einstellungen</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
          {/* Woche */}
          <section className="rule lg:col-span-12" aria-label="Diese Woche">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-sm text-muted">Diese Woche, <span className="tnum">KW {isoWeek(now)}</span></p>
                <p className="tnum mt-1 text-[30px] font-medium leading-tight">
                  {doneMin > 0 ? formatDuration(doneMin) : '0 h'} <span className="text-muted">von {plannedMin + doneMin > 0 ? formatDuration(plannedMin + doneMin) : '0 h'}</span>
                </p>
              </div>
              <dl className="flex gap-8 text-sm">
                <div>
                  <dt className="text-muted">Geplant</dt>
                  <dd className="tnum text-xl font-medium">{planned.length}</dd>
                </div>
                <div>
                  <dt className="text-muted">Absolviert</dt>
                  <dd className="tnum text-xl font-medium">{done.length}</dd>
                </div>
                <div>
                  <dt className="text-muted">Belastung</dt>
                  <dd className="tnum text-xl font-medium">{load > 0 ? Math.round(load) : '–'}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-6 grid grid-cols-7 gap-2 border-b border-line sm:gap-4" aria-label="Geplant und absolviert pro Tag">
              {perDay.map((x, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="flex h-24 w-full max-w-[44px] items-end justify-center gap-1">
                    <span className="w-1/2 border border-b-0 border-dashed border-muted" style={{ height: `${(x.p / dayMax) * 100}%` }} title={`Geplant ${formatDuration(x.p)}`} />
                    <span className="cat-training w-1/2 bg-cat" style={{ height: `${(x.c / dayMax) * 100}%` }} title={`Absolviert ${formatDuration(x.c)}`} />
                  </div>
                  <span className={`pb-2 text-xs font-medium ${isSameDay(x.d, now) ? 'text-accent' : 'text-muted'}`}>{SHORT[i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-5 text-xs text-muted">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 border border-dashed border-muted" /> Geplant</span>
              <span className="inline-flex items-center gap-2"><span className="cat-training h-2.5 w-2.5 bg-cat" /> Absolviert</span>
            </div>
          </section>

          {/* Einheiten nach Wochen */}
          <section className="min-w-0 space-y-6 lg:col-span-8">
            {items.length === 0 ? (
              <div className="rounded border border-line bg-surface">
                <EmptyState icon="activity" title="Keine Trainings" text="In Intervals.icu sind für diesen Zeitraum keine Einheiten eingetragen." />
              </div>
            ) : (
              [...weeks.entries()].map(([key, list]) => {
                const label =
                  key === thisWeek.getTime() ? 'Diese Woche' : key === addDays(thisWeek, 7).getTime() ? 'Nächste Woche' : key === addDays(thisWeek, -7).getTime() ? 'Letzte Woche' : `KW ${isoWeek(new Date(key))}`
                return (
                  <div key={key}>
                    <h2 className="h-section mb-1">{label}</h2>
                    <ul className="divide-y divide-line border-y border-line">
                      {list.map((e) => {
                        const min = minutesOf(e)
                        const missed = !e.completed && startOfDay(e.start) < startOfDay(now)
                        return (
                          <li key={e.id}>
                            <button type="button" onClick={() => onOpen(e)} className={`cat-training flex min-h-14 w-full items-center gap-4 py-3 text-left transition-colors duration-150 hover:bg-surface2/50 ${missed ? 'opacity-55' : ''}`}>
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${e.completed ? 'bg-cat text-surface' : 'border border-dashed border-cat/60 text-cat'}`}>
                                <Icon name={sportIcon(e.sport)} size={20} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{e.title}</span>
                                <span className="tnum block text-sm text-muted">
                                  {fmtDay.format(e.start).replace(/\./g, '')}
                                  {e.allDay ? ', ohne Uhrzeit' : `, ${formatTime(e.start)}`}
                                  {e.completed ? ', absolviert' : ''}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="tnum text-[15px]">{min ? formatDuration(min) : '–'}</span>
                                {e.completed ? (
                                  <span className="tnum text-xs text-muted">
                                    {e.distanceKm ? `${e.distanceKm.toFixed(1)} km` : ''}
                                    {e.distanceKm && e.load ? ', ' : ''}
                                    {e.load ? `Last ${Math.round(e.load)}` : ''}
                                  </span>
                                ) : (
                                  e.intensity === 'high' && <span className="text-xs font-medium text-ink">Intensiv</span>
                                )}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })
            )}
          </section>

          <aside className="space-y-6 lg:col-span-4">
            {next && (
              <button type="button" onClick={() => onOpen(next)} className="cat-training rule block w-full text-left">
                <span className="text-sm text-muted">Nächste Einheit</span>
                <span className="mt-2 flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-cat text-surface">
                    <Icon name={sportIcon(next.sport)} size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-semibold">{next.title}</span>
                    <span className="tnum block text-sm text-muted">
                      {fmtDay.format(next.start).replace(/\./g, '')}
                      {next.allDay ? '' : `, ${formatTime(next.start)}`}
                      {minutesOf(next) ? `, ${formatDuration(minutesOf(next))}` : ''}
                    </span>
                  </span>
                </span>
              </button>
            )}
            {bySport.size > 0 && (
              <section className="rule">
                <h2 className="h-section mb-3">Geplant nach Sportart</h2>
                <ul className="space-y-2.5">
                  {[...bySport.entries()].map(([k, m]) => (
                    <li key={k} className="cat-training flex items-center gap-3 text-sm">
                      <Icon name={k} size={18} className="text-cat" />
                      <span className="flex-1">{SPORT_NAME[k]}</span>
                      <span className="tnum font-medium">{m > 0 ? formatDuration(m) : '–'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="px-1 text-xs text-muted">
              Aktivitäten, die Intervals.icu von Strava übernommen hat, gibt die Schnittstelle teilweise nicht heraus. Sie fehlen dann hier.
            </p>
          </aside>
        </div>
      )}
    </Page>
  )
}
