import { useState } from 'react'
import type { FormEvent } from 'react'
import { addDays, formatCountdown, formatDateLong, formatDuration, formatTime, formatWeekday, isoWeek, startOfDay } from '../domain/dateUtils'
import { deadlineUrgency, eventsForDay, findFreeSlots, findOverlaps, isHeavyDay, busyMinutes, nextEvent } from '../domain/schedule'
import type { CalendarEvent } from '../domain/types'
import Icon, { sportIcon } from './icons'
import { CATEGORY_LABEL, EmptyState, EventRow, catClass, formatEventTime } from './kit'

interface Props {
  events: CalendarEvent[]
  now: Date
  loading: boolean
  firstName: string | null
  readOnly: boolean
  onOpen: (e: CalendarEvent) => void
  onCreate: (date: Date, time?: Date) => void
  onCreateNote: (date: Date) => void
  onQuickNote: (title: string) => Promise<void>
  onOpenDay: (d: Date) => void
  onGoTraining: () => void
}

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

type Row = { kind: 'event'; e: CalendarEvent; t: number } | { kind: 'free'; start: Date; end: Date; minutes: number; study: { start: Date; end: Date } | null; t: number }

export default function Dashboard(p: Props) {
  const { events, now } = p
  const today = startOfDay(now)
  const day = eventsForDay(events, today)
  const notes = day.allDay.filter((e) => e.kind === 'note')
  const allDayEvents = day.allDay.filter((e) => e.kind !== 'note')
  const next = nextEvent(events, now)
  const overlaps = findOverlaps(day.timed)
  const busy = busyMinutes(day.timed, today)
  const urgent = events
    .filter((e) => deadlineUrgency(e, now) !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const free = findFreeSlots(day, today, now)
  const rows: Row[] = [
    ...day.timed.map((e): Row => ({ kind: 'event', e, t: e.start.getTime() })),
    ...free.map((f): Row => ({ kind: 'free', ...f, t: f.start.getTime() })),
  ].sort((a, b) => a.t - b.t)

  const upcomingDays = Array.from({ length: 6 }, (_, i) => addDays(today, i + 1)).map((d) => {
    const { allDay, timed } = eventsForDay(events, d)
    return { date: d, items: [...allDay, ...timed] }
  })
  const training = events
    .filter((e) => e.source === 'intervals' && e.start >= today)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <header className="mb-6">
        <p className="tnum text-sm text-muted">
          <span className="capitalize">{formatWeekday(now)}</span>, {formatDateLong(now)} · KW {isoWeek(now)}
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight">
          {greeting(now)}
          {p.firstName ? `, ${p.firstName}` : ''}
        </h1>
      </header>

      {(urgent.length > 0 || overlaps.size > 0 || isHeavyDay(busy)) && (
        <div className="mb-6 space-y-2">
          {urgent.slice(0, 3).map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => p.onOpen(e)}
              className="flex w-full items-center gap-3 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-left text-sm transition-colors hover:bg-danger/10"
            >
              <Icon name="alert" size={16} className="shrink-0 text-danger" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{e.kind === 'exam' ? 'Prüfung' : 'Frist'}:</span> {e.title}
              </span>
              <span className="tnum shrink-0 font-semibold text-danger">{formatCountdown(now, e.start)}</span>
            </button>
          ))}
          {overlaps.size > 0 && (
            <p className="flex items-center gap-3 rounded-md bg-surface2 px-3 py-2.5 text-sm">
              <Icon name="alert" size={16} className="shrink-0 text-muted" />
              Heute überschneiden sich {overlaps.size} Termine.
            </p>
          )}
          {isHeavyDay(busy) && (
            <p className="flex items-center gap-3 rounded-md bg-surface2 px-3 py-2.5 text-sm">
              <Icon name="clock" size={16} className="shrink-0 text-muted" />
              Langer Tag: {formatDuration(busy)} verplant.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),20rem]">
        <div className="min-w-0 space-y-8">
          {/* Als Nächstes */}
          {next ? (
            <button
              type="button"
              onClick={() => p.onOpen(next)}
              className={`${catClass(next.category)} group relative w-full overflow-hidden rounded-xl bg-accent px-5 py-5 text-left text-accentink transition-transform duration-150 hover:-translate-y-px md:px-6`}
            >
              <span className="text-xs font-medium uppercase tracking-wider opacity-80">Als Nächstes</span>
              <span className="mt-2 flex items-end justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-xl font-semibold">{next.title}</span>
                  <span className="tnum mt-1 block text-sm opacity-85">
                    {formatEventTime(next, startOfDay(next.start).getTime() !== today.getTime())} · {CATEGORY_LABEL[next.category]}
                  </span>
                </span>
                <span className="tnum shrink-0 text-2xl font-semibold">{formatCountdown(now, next.start)}</span>
              </span>
            </button>
          ) : (
            !p.loading && (
              <div className="rounded-xl border border-dashed border-line px-5 py-5 text-sm text-muted">Kein weiterer Termin geplant.</div>
            )
          )}

          {/* Heute */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Heute</h2>
              <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => p.onOpenDay(today)}>
                Im Kalender öffnen
              </button>
            </div>
            {p.loading && events.length === 0 ? (
              <p className="py-6 text-sm text-muted">Lädt …</p>
            ) : rows.length === 0 && allDayEvents.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface">
                <EmptyState
                  icon="calendar"
                  title="Heute ist nichts geplant"
                  text="Das gilt für alle verbundenen Quellen. Nutze die Zeit oder plane etwas ein."
                  action={!p.readOnly && <button type="button" className="btn-primary" onClick={() => p.onCreate(today)}>Termin planen</button>}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-surface p-1.5">
                {allDayEvents.map((e) => (
                  <EventRow key={e.id} e={e} onOpen={p.onOpen} />
                ))}
                {rows.map((r) =>
                  r.kind === 'event' ? (
                    <EventRow key={r.e.id} e={r.e} onOpen={p.onOpen} dim={(r.e.end ?? r.e.start) < now} />
                  ) : (
                    <div key={`free-${r.t}`} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
                      <span className="w-[3px] self-stretch rounded-full border-l border-dashed border-muted/50" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="text-muted">Frei</span>{' '}
                        <span className="tnum text-muted">
                          {formatTime(r.start)}–{formatTime(r.end)} · {formatDuration(r.minutes)}
                        </span>
                        {r.study && <span className="ml-2 text-xs font-medium text-accent">Lernblock möglich</span>}
                      </span>
                      {!p.readOnly && (
                        <button
                          type="button"
                          className="btn-ghost min-h-9 px-2 text-xs text-accent"
                          onClick={() => p.onCreate(today, r.study?.start ?? r.start)}
                        >
                          <Icon name="plus" size={14} /> Einplanen
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          {!p.readOnly && <QuickCapture onQuickNote={p.onQuickNote} onCreate={() => p.onCreate(today)} onCreateNote={() => p.onCreateNote(today)} />}

          {notes.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">Notizen für heute</h2>
              <div className="space-y-2">
                {notes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => p.onOpen(n)}
                    className={`${catClass(n.category)} block w-full rounded-md border-l-[3px] border-cat bg-surface2 px-3 py-2.5 text-left transition-colors hover:bg-line/60`}
                  >
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    {n.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.description}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-base font-semibold">Nächste Tage</h2>
            <ol className="divide-y divide-line">
              {upcomingDays.map((d) => (
                <li key={d.date.getTime()}>
                  <button type="button" onClick={() => p.onOpenDay(d.date)} className="flex w-full gap-3 py-2.5 text-left transition-colors hover:bg-surface2">
                    <span className="w-10 shrink-0 text-center">
                      <span className="block text-[10px] font-medium uppercase text-muted">
                        {new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(d.date).replace('.', '')}
                      </span>
                      <span className="tnum block text-base font-semibold">{d.date.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                      {d.items.length === 0 && <span className="block text-xs text-muted">Frei</span>}
                      {d.items.slice(0, 3).map((e) => (
                        <span key={e.id} className={`${catClass(e.category)} flex items-center gap-2 text-xs`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.kind === 'note' ? 'border border-cat' : 'bg-cat'}`} aria-hidden="true" />
                          {!e.allDay && <span className="tnum shrink-0 text-muted">{formatTime(e.start)}</span>}
                          <span className="truncate">{e.title}</span>
                        </span>
                      ))}
                      {d.items.length > 3 && <span className="block text-[11px] text-muted">+{d.items.length - 3} weitere</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {training.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Training</h2>
                <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={p.onGoTraining}>
                  Alle
                </button>
              </div>
              <div className="space-y-1">
                {training.map((e) => (
                  <button key={e.id} type="button" onClick={() => p.onOpen(e)} className="cat-training flex w-full items-center gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-surface2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cat/15 text-cat">
                      <Icon name={sportIcon(e.sport)} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="tnum block text-xs text-muted">
                        {formatEventTime(e, true).split(' · ')[0]}
                        {e.allDay ? '' : ` · ${formatTime(e.start)}`}
                        {e.plannedMinutes ? ` · ${formatDuration(e.plannedMinutes)}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function QuickCapture({ onQuickNote, onCreate, onCreateNote }: { onQuickNote: (t: string) => Promise<void>; onCreate: () => void; onCreateNote: () => void }) {
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const t = text.trim()
    if (!t) return
    setState('busy')
    try {
      await onQuickNote(t)
      setText('')
      setState('done')
      setMsg('Als Notiz für heute gespeichert.')
    } catch (err) {
      setState('error')
      setMsg(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <section className="rounded-lg bg-surface2 p-4">
      <h2 className="mb-2 text-sm font-semibold">Schnell festhalten</h2>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="quick" className="sr-only">
          Notiz für heute
        </label>
        <input
          id="quick"
          className="field bg-surface"
          placeholder="Notiz für heute …"
          value={text}
          maxLength={200}
          onChange={(e) => {
            setText(e.target.value)
            if (state !== 'busy') setState('idle')
          }}
        />
        <button type="submit" className="btn-primary h-11 w-11 shrink-0 px-0" disabled={state === 'busy' || !text.trim()} aria-label="Notiz speichern">
          <Icon name="arrowRight" size={18} />
        </button>
      </form>
      {state === 'done' || state === 'error' ? (
        <p className={`mt-2 text-xs ${state === 'error' ? 'text-danger' : 'text-muted'}`} role="status">
          {msg}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-outline min-h-9 flex-1 px-2 text-xs" onClick={onCreate}>
          <Icon name="calendar" size={14} /> Termin
        </button>
        <button type="button" className="btn-outline min-h-9 flex-1 px-2 text-xs" onClick={onCreateNote}>
          <Icon name="note" size={14} /> Notiz mit Text
        </button>
      </div>
    </section>
  )
}
