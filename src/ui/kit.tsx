import { useEffect, useRef } from 'react'
import { evClass } from './labels'
import type { ReactNode } from 'react'
import { formatDuration, formatTime, minutesBetween } from '../domain/dateUtils'
import { CATEGORY_LABEL, PRIORITY_LABEL } from '../domain/types'
import type { CalendarEvent, Category, Priority } from '../domain/types'
import Icon from './icons'

export const CATEGORIES: Category[] = ['training', 'work', 'study', 'private']

/** CSS-Klasse, die die Kategoriefarbe als Variable setzt (siehe index.css). */
export const catClass = (c: Category) => `cat-${c}`

export function CategoryDot({ category, className = '' }: { category: Category; className?: string }) {
  return <span className={`${catClass(category)} inline-block h-2 w-2 shrink-0 rounded-full bg-cat ${className}`} aria-hidden="true" />
}

const fmtDayShort = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })

/** "14:30–15:15 · 45 min", "ab 18:00", "Ganztägig" */
export function formatEventTime(e: CalendarEvent, withDay = false): string {
  const day = withDay ? `${fmtDayShort.format(e.start).replace(/\./g, '')} · ` : ''
  if (e.allDay) return `${day}Ganztägig`
  if (!e.end) return `${day}${formatTime(e.start)}`
  return `${day}${formatTime(e.start)}–${formatTime(e.end)} · ${formatDuration(minutesBetween(e.start, e.end))}`
}

export function kindLabel(e: CalendarEvent): string | null {
  if (e.kind === 'note') return 'Notiz'
  if (e.kind === 'task') return 'Aufgabe'
  if (e.kind === 'exam') return 'Prüfung'
  if (e.kind === 'deadline') return 'Frist'
  return null
}

export function SourceTag({ e }: { e: CalendarEvent }) {
  const label =
    e.source === 'own' ? null : e.source === 'google' ? 'Google' : e.source === 'intervals' ? 'Intervals' : 'Demo'
  if (!label) return null
  return (
    <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-px text-[10px] font-medium text-muted">
      {label}
    </span>
  )
}

const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'text-muted',
  medium: 'text-ink',
  high: 'text-warn',
  urgent: 'text-danger',
}

export function PriorityTag({ p }: { p?: Priority }) {
  // Nur hohe Prioritäten markieren, sonst wird es unruhig
  if (!p || p === 'low' || p === 'medium') return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${PRIORITY_STYLE[p]}`}>
      <span aria-hidden="true">{p === 'urgent' ? '!!' : '!'}</span>
      {PRIORITY_LABEL[p]}
    </span>
  )
}

/** Eine Zeile in Listen (Dashboard, Agenda, Tagesliste). */
export function EventRow({ e, onOpen, showDay = false, dim = false }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void; showDay?: boolean; dim?: boolean }) {
  const kind = kindLabel(e)
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      className={`${evClass(e)} group flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-surface2 ${dim ? 'opacity-55' : ''}`}
    >
      <span className={`mt-0.5 w-[3px] self-stretch rounded-full ${e.kind === 'note' ? 'bg-cat/40' : 'bg-cat'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {e.kind === 'note' && <Icon name="note" size={14} className="shrink-0 text-muted" />}
          {e.kind === 'task' && <Icon name={e.done ? 'checkCircle' : 'circle'} size={14} className="shrink-0 text-muted" />}
          <span className={`truncate text-sm font-medium ${e.done ? 'text-muted line-through' : ''}`}>{e.title}</span>
        </span>
        <span className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>
            {e.kind === 'note' || (e.kind === 'task' && e.allDay)
              ? showDay
                ? formatEventTime(e, true).replace(' · Ganztägig', '')
                : e.kind === 'note'
                  ? 'Notiz'
                  : 'Fällig heute'
              : e.kind === 'task'
                ? `Fällig ${formatEventTime(e, showDay)}`
                : formatEventTime(e, showDay)}
          </span>
          {kind && e.kind !== 'note' && <span className="font-semibold text-ink">{kind}</span>}
          <PriorityTag p={e.priority} />
          <SourceTag e={e} />
        </span>
      </span>
    </button>
  )
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Auf dem Handy ein Blatt von unten, am Desktop ein Dialog in der Mitte. Escape schliesst. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => {
      // Zuerst das ausdrücklich markierte Feld, sonst das erste Eingabefeld, zuletzt ein Knopf
      const first =
        panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.current?.querySelector<HTMLElement>('input, textarea, select') ??
        panel.current?.querySelector<HTMLElement>('button')
      first?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="presentation">
      <div className="anim-fade absolute inset-0 bg-deep/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-sheet md:max-w-xl md:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 px-6 pb-2 pt-4 backdrop-blur">
          <h2 className="h-display text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 h-10 min-h-10 w-10 px-0" aria-label="Schliessen">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3.5 font-medium transition-colors ${size === 'sm' ? 'min-h-8 text-xs' : 'min-h-9 text-sm'} ${
            value === o.value ? 'bg-deep text-deepink' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-sun/20 text-ink">
        <Icon name={icon} size={20} />
      </span>
      <p className="h-section">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { CATEGORY_LABEL }
