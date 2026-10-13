import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { moveBy, resizeBy } from '../../domain/move'
import { addDays, formatTime, formatWeekdayShort, isSameDay, startOfDay } from '../../domain/dateUtils'
import { eventsForDay, findOverlaps } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import { layoutDay } from '../../domain/weekLayout'
import Icon from '../icons'
import { catClass } from '../kit'

const HOUR_PX = 52
const DAY_PX = HOUR_PX * 24
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  days: Date[]
  events: CalendarEvent[]
  now: Date
  onOpen: (e: CalendarEvent) => void
  /** Klick auf eine freie Stelle: neuer Termin zu dieser Zeit. Fehlt im Demo-Modus. */
  onCreateAt?: (at: Date) => void
  onPickDay?: (d: Date) => void
  /** Ziehen mit Maus oder Stift: neue Zeiten für einen eigenen Termin. Fehlt = nicht verschiebbar. */
  onMove?: (e: CalendarEvent, start: Date, end: Date | null) => void
}

/** Nur eigene, einzelne Termine mit Uhrzeit lassen sich ziehen (Serien und Importe nicht). */
export const canDrag = (e: CalendarEvent) =>
  e.source === 'own' && e.ref?.type === 'entry' && !e.allDay && (!e.recurrence || e.recurrence === 'none') && e.kind === 'event'

interface Drag {
  id: string
  mode: 'move' | 'resize'
  x: number
  y: number
  dx: number
  dy: number
  colWidth: number
  dayIndex: number
  moved: boolean
}

/** Zeitraster für einen oder mehrere Tage (Tages- und Wochenansicht). */
export default function TimeGrid({ days, events, now, onOpen, onCreateAt, onPickDay, onMove }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const multi = days.length > 1
  const perDay = days.map((d) => ({ date: d, ...eventsForDay(events, d) }))
  const hasAllDay = perDay.some((d) => d.allDay.length > 0)
  const firstKey = days[0]?.getTime()

  // Beim Öffnen zur sinnvollen Uhrzeit scrollen: jetzt (wenn heute sichtbar) oder 07:00.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const showsToday = days.some((d) => isSameDay(d, now))
    const hour = showsToday ? Math.min(Math.max(now.getHours() - 1, 6), 17) : 7
    el.scrollTop = hour * HOUR_PX
  }, [firstKey, days.length])

  const createAt = (day: Date, ev: MouseEvent<HTMLDivElement>) => {
    if (!onCreateAt) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const minutes = Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 2) * 30
    const clamped = Math.min(Math.max(minutes, 0), 23 * 60)
    onCreateAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(clamped / 60), clamped % 60))
  }

  const cols = `3.25rem repeat(${days.length}, minmax(0, 1fr))`

  // Ziehen: Zustand während der Geste, danach einen Klick unterdrücken
  const [drag, setDrag] = useState<Drag | null>(null)
  const swallowClick = useRef(false)
  const preview = (e: CalendarEvent, d: Drag) => {
    const dMin = (d.dy / HOUR_PX) * 60
    if (d.mode === 'resize' && e.end) return { start: e.start, end: resizeBy(e.start, e.end, dMin), dDays: 0 }
    const dDays = multi && d.colWidth > 0 ? Math.max(-d.dayIndex, Math.min(Math.round(d.dx / d.colWidth), days.length - 1 - d.dayIndex)) : 0
    return { ...moveBy(e.start, e.end, dMin, dDays), dDays }
  }
  const startDrag = (ev: PointerEvent<HTMLElement>, e: CalendarEvent, mode: Drag['mode'], dayIndex: number) => {
    if (!onMove || !canDrag(e) || ev.pointerType === 'touch' || ev.button !== 0) return
    ev.stopPropagation()
    const col = (ev.currentTarget.closest('[data-col]') as HTMLElement | null)?.offsetWidth ?? 0
    ev.currentTarget.setPointerCapture(ev.pointerId)
    setDrag({ id: e.id, mode, x: ev.clientX, y: ev.clientY, dx: 0, dy: 0, colWidth: col, dayIndex, moved: false })
  }
  const moveDrag = (ev: PointerEvent<HTMLElement>) => {
    if (!drag) return
    const dx = ev.clientX - drag.x
    const dy = ev.clientY - drag.y
    if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    setDrag({ ...drag, dx, dy, moved: true })
  }
  const endDrag = (e: CalendarEvent) => {
    if (!drag) return
    if (drag.moved && onMove) {
      const p = preview(e, drag)
      swallowClick.current = true
      if (p.start.getTime() !== e.start.getTime() || (p.end?.getTime() ?? 0) !== (e.end?.getTime() ?? 0)) onMove(e, p.start, p.end)
    }
    setDrag(null)
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface">
      {multi && (
        <div className="grid border-b border-line/70" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const today = isSameDay(d, now)
            return (
              <button
                key={d.getTime()}
                type="button"
                onClick={() => onPickDay?.(d)}
                className="flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-surface2"
                aria-label={`${formatWeekdayShort(d)} ${d.getDate()}. öffnen`}
              >
                <span className={`text-xs font-medium ${today ? 'text-ink' : 'text-muted'}`}>{formatWeekdayShort(d)}</span>
                <span className={`h-display tnum flex h-9 w-9 items-center justify-center rounded-full text-lg ${today ? 'bg-sun text-sunink' : ''}`}>
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {hasAllDay && (
        <div className="grid border-b border-line/70" style={{ gridTemplateColumns: cols }}>
          <div className="px-1 py-2 text-right text-[10px] leading-4 text-muted">Tag</div>
          {perDay.map((d) => (
            <div key={d.date.getTime()} className="min-w-0 space-y-1 border-l border-line/60 p-1.5">
              {d.allDay.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  className={`${catClass(e.category)} flex w-full items-center gap-1 truncate rounded-md px-2 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${
                    e.kind === 'note' ? 'bg-surface2 text-ink' : e.kind === 'task' ? 'border border-cat/50 text-ink' : 'bg-cat/15 text-ink'
                  }`}
                >
                  {e.kind === 'note' && <Icon name="note" size={11} className="shrink-0 text-muted" />}
                  {e.kind === 'task' && <Icon name={e.done ? 'checkCircle' : 'circle'} size={11} className="shrink-0 text-muted" />}
                  <span className={`truncate ${e.done ? 'text-muted line-through' : ''}`}>{e.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="relative max-h-[calc(100dvh-15rem)] min-h-[22rem] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: DAY_PX }}>
          <div className="relative">
            {HOURS.map((h) => (
              <span key={h} className="tnum absolute right-2 -translate-y-1/2 text-[10px] text-muted" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {perDay.map(({ date, timed }, dayIndex) => {
            const blocks = layoutDay(timed, date, 0, 24)
            const overlaps = findOverlaps(timed)
            const today = isSameDay(date, now)
            const nowTop = ((now.getTime() - startOfDay(now).getTime()) / (addDays(startOfDay(now), 1).getTime() - startOfDay(now).getTime())) * DAY_PX
            return (
              <div
                key={date.getTime()}
                data-col
                className={`relative border-l border-line/60 ${onCreateAt ? 'cursor-cell' : ''} ${today && multi ? 'bg-sun/[0.05]' : ''}`}
                style={{ backgroundImage: 'linear-gradient(to bottom, rgb(var(--line) / 0.7) 1px, transparent 1px)', backgroundSize: `100% ${HOUR_PX}px` }}
                onClick={(ev) => createAt(date, ev)}
              >
                {blocks.map((b) => {
                  const e = b.event
                  const dragging = drag?.id === e.id && drag.moved ? drag : null
                  const p = dragging ? preview(e, dragging) : null
                  const draggable = !!onMove && canDrag(e)
                  // Während des Ziehens: Vorschau an der neuen Stelle
                  const pTop = p ? ((p.start.getHours() * 60 + p.start.getMinutes()) / 1440) * DAY_PX : null
                  const pHeight = p && p.end ? ((p.end.getTime() - p.start.getTime()) / 86400000) * DAY_PX : null
                  const height = Math.max(pHeight ?? b.width * DAY_PX, 22)
                  const short = height < 40
                  // Art sichtbar machen: Prüfung voll gefärbt, Lerntermin gestrichelt, Aufgabe als Umriss, Training absolviert mit Haken
                  const style =
                    e.kind === 'exam'
                      ? { background: 'rgb(var(--exam))', color: 'white' }
                      : e.kind === 'task'
                        ? { background: 'rgb(var(--surface))', border: '1.5px solid rgb(var(--c) / 0.6)' }
                        : e.examId
                          ? { background: 'linear-gradient(rgb(var(--c) / 0.1), rgb(var(--c) / 0.1)), rgb(var(--surface))', border: '1.5px dashed rgb(var(--c) / 0.7)' }
                          : { background: 'linear-gradient(rgb(var(--c) / 0.17), rgb(var(--c) / 0.17)), rgb(var(--surface))' }
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (swallowClick.current) {
                          swallowClick.current = false
                          return
                        }
                        onOpen(e)
                      }}
                      onPointerDown={(ev) => startDrag(ev, e, 'move', dayIndex)}
                      onPointerMove={moveDrag}
                      onPointerUp={() => endDrag(e)}
                      onPointerCancel={() => setDrag(null)}
                      className={`${catClass(e.category)} absolute flex flex-col justify-start overflow-hidden rounded-[9px] px-2 text-left transition-[filter,transform] hover:brightness-95 active:scale-[0.99] dark:hover:brightness-125 ${
                        e.kind === 'exam' ? '' : 'text-ink'
                      } ${overlaps.has(e.id) ? 'ring-2 ring-danger/50' : ''} ${e.kind !== 'exam' && e.kind !== 'task' && !e.examId ? 'border-l-[3px] border-cat' : ''} ${
                        draggable ? 'cursor-grab' : ''
                      } ${dragging ? 'z-20 cursor-grabbing opacity-90 shadow-float transition-none' : ''}`}
                      style={{
                        ...style,
                        top: (pTop ?? b.left * DAY_PX) + 1,
                        height: height - 2,
                        left: dragging ? '2px' : `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
                        width: dragging ? 'calc(100% - 4px)' : `calc(${100 / b.lanes}% - 4px)`,
                        transform: p && p.dDays ? `translateX(${p.dDays * (dragging?.colWidth ?? 0)}px)` : undefined,
                        touchAction: draggable ? 'none' : undefined,
                      }}
                      title={`${e.title}${overlaps.has(e.id) ? ' (überschneidet sich)' : ''}`}
                    >
                      <span className={`block truncate text-[11px] font-semibold leading-tight ${short ? 'pt-0.5' : 'pt-1'}`}>
                        {short && <span className={`tnum mr-1 font-normal ${e.kind === 'exam' ? 'text-white/80' : 'text-muted'}`}>{formatTime(e.start)}</span>}
                        {e.kind === 'task' && <Icon name={e.done ? 'checkCircle' : 'circle'} size={11} className="mr-1 inline -translate-y-px text-muted" />}
                        <span className={e.done && e.kind === 'task' ? 'text-muted line-through' : ''}>{e.kind === 'exam' ? `Prüfung: ${e.title}` : e.title}</span>
                      </span>
                      {(!short || p) && (
                        <span className={`tnum block truncate text-[10px] ${e.kind === 'exam' ? 'text-white/80' : p ? 'font-semibold text-ink' : 'text-muted'}`}>
                          {formatTime(p?.start ?? e.start)}
                          {(p ? p.end : e.end) ? `–${formatTime((p ? p.end : e.end)!)}` : ''}
                        </span>
                      )}
                      {draggable && e.end && (
                        <span
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          onPointerDown={(ev) => startDrag(ev, e, 'resize', dayIndex)}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
                {today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-hidden="true">
                    <span className="-ml-1.5 h-3 w-3 rounded-full bg-sun ring-2 ring-surface" />
                    <span className="h-0.5 flex-1 bg-sun" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
