import { useState } from 'react'
import { addDays, formatTime, isSameDay, startOfDay, startOfWeek } from '../../domain/dateUtils'
import { shiftDays } from '../../domain/move'
import { eventsForDay } from '../../domain/schedule'
import type { CalendarEvent } from '../../domain/types'
import Icon from '../icons'
import { catClass } from '../kit'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  /** Ausgewählter Tag (mit Seitenleiste) */
  selected?: Date
  month: Date
  events: CalendarEvent[]
  now: Date
  onOpen: (e: CalendarEvent) => void
  onPickDay: (d: Date) => void
  /** Eigenen Eintrag auf einen anderen Tag gezogen. Fehlt = nicht ziehbar. */
  onMove?: (e: CalendarEvent, start: Date, end: Date | null) => void
}

/** Im Monat ziehbar: eigene einzelne Termine und Notizen (keine Serien, keine Importe). */
const canMoveDay = (e: CalendarEvent) =>
  e.source === 'own' && e.ref?.type === 'entry' && (!e.recurrence || e.recurrence === 'none') && (e.kind === 'event' || e.kind === 'note')

export default function MonthView({ selected, month, events, now, onOpen, onPickDay, onMove }: Props) {
  const [dragging, setDragging] = useState<CalendarEvent | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const drop = (d: Date) => {
    const e = dragging
    setDragging(null)
    setOver(null)
    if (!e || !onMove) return
    const dDays = Math.round((startOfDay(d).getTime() - startOfDay(e.start).getTime()) / 86400000)
    if (dDays === 0) return
    const r = shiftDays(e.start, e.end, dDays)
    onMove(e, r.start, r.end)
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = startOfWeek(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  // Letzte Zeile weglassen, wenn sie komplett im Folgemonat liegt.
  const visible = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days

  return (
    <div className="overflow-hidden rounded-xl bg-surface">
      <div className="grid grid-cols-7 border-b border-line/70">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2.5 text-center text-xs font-medium text-muted">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {visible.map((d, i) => {
          const { timed, allDay } = eventsForDay(events, d)
          const all = [...allDay, ...timed]
          const inMonth = d.getMonth() === month.getMonth()
          const today = isSameDay(d, now)
          const isSel = !!selected && isSameDay(d, selected)
          return (
            <div
              key={d.getTime()}
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(d)}
              onDragOver={(ev) => {
                if (!dragging) return
                ev.preventDefault()
                ev.dataTransfer.dropEffect = 'move'
                if (over !== d.getTime()) setOver(d.getTime())
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget as Node | null) && over === d.getTime()) setOver(null)
              }}
              onDrop={(ev) => {
                ev.preventDefault()
                drop(d)
              }}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  onPickDay(d)
                }
              }}
              aria-label={`${d.getDate()}. ${all.length} Einträge, Tag öffnen`}
              className={`relative min-h-[4.5rem] cursor-pointer border-line/60 p-1 transition-colors hover:bg-surface2/70 md:min-h-[8rem] md:p-2 ${i % 7 !== 0 ? 'border-l' : ''} ${
                i >= 7 ? 'border-t' : ''
              } ${inMonth ? '' : 'bg-canvas/60'} ${isSel ? 'bg-accent/[0.06] shadow-[inset_0_0_0_2px_rgb(var(--accent))]' : ''} ${
                over === d.getTime() ? 'bg-sun/15 shadow-[inset_0_0_0_2px_rgb(var(--sun))]' : ''
              }`}
            >
              <span
                className={`tnum mb-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                  today ? 'bg-sun text-sunink' : inMonth ? '' : 'text-muted/50'
                }`}
              >
                {d.getDate()}
              </span>
              {/* Handy: nur Punkte */}
              <div className="flex flex-wrap gap-1 px-1 md:hidden">
                {all.slice(0, 5).map((e) => (
                  <span key={e.id} className={`${catClass(e.category)} h-1.5 w-1.5 rounded-full ${e.kind === 'note' ? 'border border-cat' : 'bg-cat'}`} aria-hidden="true" />
                ))}
              </div>
              {/* Desktop: Einträge */}
              <div className="hidden space-y-0.5 md:block">
                {all.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    draggable={!!onMove && canMoveDay(e)}
                    onDragStart={(ev) => {
                      ev.dataTransfer.effectAllowed = 'move'
                      ev.dataTransfer.setData('text/plain', e.title)
                      setDragging(e)
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpen(e)
                    }}
                    className={`${catClass(e.category)} flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-[3px] text-left text-[11px] transition-colors ${onMove && canMoveDay(e) ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging?.id === e.id ? 'opacity-40' : ''} ${
                      e.kind === 'exam' ? 'bg-exam font-semibold text-white' : e.allDay && e.kind !== 'note' && e.kind !== 'task' ? 'bg-cat/15 font-medium hover:bg-cat/25' : 'hover:bg-cat/10'
                    }`}
                  >
                    {e.kind === 'note' || e.kind === 'task' ? (
                      <Icon name={e.kind === 'note' ? 'note' : e.done ? 'checkCircle' : 'circle'} size={11} className="shrink-0 text-muted" />
                    ) : (
                      !e.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cat" aria-hidden="true" />
                    )}
                    {!e.allDay && <span className={`tnum shrink-0 ${e.kind === 'exam' ? 'text-white/80' : 'text-muted'}`}>{formatTime(e.start)}</span>}
                    <span className={`truncate ${e.done && e.kind === 'task' ? 'text-muted line-through' : ''}`}>{e.title}</span>
                  </button>
                ))}
                {all.length > 3 && <p className="px-1.5 text-[11px] font-medium text-muted">{all.length - 3} weitere</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
