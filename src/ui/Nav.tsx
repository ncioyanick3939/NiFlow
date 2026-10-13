import { formatTime } from '../domain/dateUtils'
import type { SourceState } from '../sources/types'
import Icon from './icons'
import type { IconName } from './icons'

export type Section = 'dashboard' | 'calendar' | 'tasks' | 'exams' | 'activities' | 'training' | 'settings'

export const SECTIONS: { id: Section; label: string; icon: IconName; hash: string }[] = [
  { id: 'dashboard', label: 'Übersicht', icon: 'dashboard', hash: 'uebersicht' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar', hash: 'kalender' },
  { id: 'tasks', label: 'Aufgaben', icon: 'tasks', hash: 'aufgaben' },
  { id: 'exams', label: 'Prüfungen', icon: 'exam', hash: 'pruefungen' },
  { id: 'activities', label: 'Aktivitäten', icon: 'layers', hash: 'aktivitaeten' },
  { id: 'training', label: 'Training', icon: 'activity', hash: 'training' },
  { id: 'settings', label: 'Einstellungen', icon: 'settings', hash: 'einstellungen' },
]

/** Wortmarke: rotes Quadrat als Punkt, sonst nur Typografie. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-sm bg-accent text-accentink" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
        <path d="M4 9h16M4 15h10" />
      </svg>
    </span>
  )
}

interface Props {
  active: Section
  onNavigate: (s: Section) => void
  onCreate?: () => void
  states: SourceState[]
  loading: boolean
  onReload: () => void
  /** Anzahl überfälliger Aufgaben */
  badge?: number
  onSearch?: () => void
}

/**
 * Seitenleiste auf hellem Papier, getrennt durch eine Linie.
 * Breit (ab xl): nur Text, aktive Seite mit roter Linie. Schmal: Icons.
 */
export function Sidebar({ active, onNavigate, onCreate, states, loading, onReload, badge, onSearch }: Props) {
  const errors = states.filter((s) => s.status === 'error')
  const last = states
    .map((s) => s.lastSync)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const main = SECTIONS.filter((s) => s.id !== 'settings')
  const settings = SECTIONS.find((s) => s.id === 'settings')!

  const item = (s: (typeof SECTIONS)[number]) => {
    const on = s.id === active
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onNavigate(s.id)}
        aria-current={on ? 'page' : undefined}
        title={s.label}
        className={`group relative flex min-h-11 w-full items-center justify-center gap-3 px-3 text-[15px] transition-colors duration-150 xl:justify-start xl:pl-4 ${
          on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        <span className={`absolute inset-y-2 left-0 w-[2px] ${on ? 'bg-accent' : 'bg-transparent group-hover:bg-line'}`} aria-hidden="true" />
        <Icon name={s.icon} size={19} className="xl:hidden" />
        <span className="mr-auto hidden xl:inline">{s.label}</span>
        {s.id === 'tasks' && !!badge && (
          <span className="tnum absolute right-1 top-1 rounded-sm bg-accent px-1 text-[10px] font-semibold leading-4 text-accentink xl:static xl:bg-transparent xl:px-0 xl:text-xs xl:font-medium xl:text-accent" aria-label={`${badge} überfällig`}>
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-line bg-canvas px-2 pb-5 pt-6 md:flex xl:w-[232px] xl:px-5">
      <div className="mb-8 flex items-center justify-center gap-2.5 xl:justify-start xl:px-4">
        <Logo size={26} />
        <span className="hidden font-display text-[19px] font-semibold tracking-[-0.03em] xl:inline">NiFlow</span>
      </div>
      {onCreate && (
        <button type="button" className="btn-primary mb-2 w-full px-0 xl:justify-start xl:px-4" onClick={onCreate} title="Neu erstellen" aria-label="Neu erstellen">
          <Icon name="plus" size={17} /> <span className="hidden xl:inline">Neu erstellen</span>
        </button>
      )}
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          title="Suchen (Strg+K)"
          aria-label="Suchen"
          className="mb-8 flex min-h-11 w-full items-center justify-center gap-3 rounded border border-line px-3 text-sm text-muted transition-colors duration-150 hover:border-muted/60 hover:text-ink xl:justify-start xl:px-4"
        >
          <Icon name="search" size={16} />
          <span className="mr-auto hidden xl:inline">Suchen</span>
          <kbd className="tnum hidden text-[11px] text-muted xl:inline">⌃K</kbd>
        </button>
      )}
      <nav aria-label="Hauptnavigation" className="space-y-0.5">
        {main.map(item)}
      </nav>
      <div className="mt-auto space-y-3 border-t border-line pt-3">
        {item(settings)}
        <div className="flex flex-col items-center gap-2 text-xs text-muted xl:flex-row xl:pl-4">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${errors.length > 0 ? 'bg-danger' : loading ? 'animate-pulse bg-muted' : 'bg-[rgb(var(--study))]'}`} aria-hidden="true" />
          <span className="mr-auto hidden xl:inline">
            {loading ? 'Lädt …' : errors.length > 0 ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} mit Fehler` : last ? <>Aktuell, <span className="tnum">{formatTime(last)}</span></> : 'Keine Quelle'}
          </span>
          <button type="button" onClick={onReload} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-ink" aria-label="Neu laden">
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

const MOBILE_MAIN: Section[] = ['dashboard', 'calendar', 'tasks', 'exams']

/** Handy: vier Hauptbereiche + «Mehr» (Training, Einstellungen). */
export function BottomBar({ active, onNavigate, onMore, badge }: { active: Section; onNavigate: (s: Section) => void; onMore: () => void; badge?: number }) {
  const items = SECTIONS.filter((s) => MOBILE_MAIN.includes(s.id))
  const moreActive = !MOBILE_MAIN.includes(active)
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      {items.map((s) => {
        const on = s.id === active
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            aria-current={on ? 'page' : undefined}
            className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150 ${on ? 'font-semibold text-ink' : 'font-medium text-muted'}`}
          >
            <span className={`absolute inset-x-4 top-0 h-[2px] ${on ? 'bg-accent' : ''}`} aria-hidden="true" />
            <Icon name={s.icon} size={20} />
            {s.label}
            {s.id === 'tasks' && !!badge && (
              <span className="tnum absolute left-1/2 top-1.5 ml-2 rounded-sm bg-accent px-1 text-[10px] font-semibold leading-4 text-accentink" aria-label={`${badge} überfällig`}>{badge}</span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        aria-current={moreActive ? 'page' : undefined}
        className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150 ${moreActive ? 'font-semibold text-ink' : 'font-medium text-muted'}`}
      >
        <span className={`absolute inset-x-4 top-0 h-[2px] ${moreActive ? 'bg-accent' : ''}`} aria-hidden="true" />
        <Icon name="more" size={20} />
        Mehr
      </button>
    </nav>
  )
}
