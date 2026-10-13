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

/** Wortmarke: runde Kachel in Rosé und Pfirsich mit Haken-Welle. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[11px] bg-gradient-to-br from-[#e8908a] to-[#f2a36e] text-white shadow-pop"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 13c3 0 3-6 6-6s3 10 6 10 2-5 4-5" />
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
  onAssistant?: () => void
}

/**
 * Seitenleiste (Tablet und Desktop): weiss, ruhig. Aktive Seite als weich getönte Rosé-Pille.
 * Schmal: nur Symbole, breit (ab xl): mit Text.
 */
export function Sidebar({ active, onNavigate, onCreate, states, loading, onReload, badge, onSearch, onAssistant }: Props) {
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
        className={`group relative flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl px-3 text-[15px] transition-colors duration-150 xl:justify-start ${
          on ? 'bg-accent/[0.13] font-bold text-accent' : 'font-semibold text-muted hover:bg-surface2 hover:text-ink'
        }`}
      >
        <Icon name={s.icon} size={21} />
        <span className="mr-auto hidden xl:inline">{s.label}</span>
        {s.id === 'tasks' && !!badge && (
          <span className="tnum absolute right-1.5 top-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white xl:static" aria-label={`${badge} überfällig`}>
            {badge}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col bg-surface px-3 pb-5 pt-6 md:flex xl:w-[256px] xl:px-4">
      <div className="mb-7 flex items-center justify-center gap-3 xl:justify-start xl:px-2">
        <Logo size={36} />
        <span className="hidden font-display text-[21px] font-bold tracking-[-0.03em] xl:inline">NiFlow</span>
      </div>
      {onCreate && (
        <button type="button" className="btn-primary mb-2 w-full min-h-12 px-0 xl:justify-start xl:px-5" onClick={onCreate} title="Neu erstellen" aria-label="Neu erstellen">
          <Icon name="plus" size={18} /> <span className="hidden xl:inline">Neu erstellen</span>
        </button>
      )}
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          title="Suchen (Strg+K)"
          aria-label="Suchen"
          className="mb-6 flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-surface2 px-3 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink xl:justify-start xl:px-4"
        >
          <Icon name="search" size={16} />
          <span className="mr-auto hidden xl:inline">Suchen</span>
          <kbd className="hidden rounded-md bg-surface px-1.5 text-[11px] xl:inline">⌃K</kbd>
        </button>
      )}
      <nav aria-label="Hauptnavigation" className="space-y-1">
        {main.map(item)}
      </nav>
      {onAssistant && (
        <button
          type="button"
          onClick={onAssistant}
          title="Planungs-Assistent"
          aria-label="Planungs-Assistent"
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-accent/[0.1] px-3 text-[15px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/[0.18] xl:justify-start"
        >
          <Icon name="sparkle" size={20} />
          <span className="hidden xl:inline">Assistent</span>
        </button>
      )}
      <div className="mt-auto space-y-3 pt-3">
        {item(settings)}
        <div className="flex flex-col items-center gap-2 text-xs text-muted xl:flex-row xl:pl-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${errors.length > 0 ? 'bg-danger' : loading ? 'animate-pulse bg-muted' : 'bg-[rgb(var(--study))]'}`} aria-hidden="true" />
          <span className="mr-auto hidden xl:inline">
            {loading ? 'Lädt …' : errors.length > 0 ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} mit Fehler` : last ? <>Aktuell, <span className="tnum">{formatTime(last)}</span></> : 'Keine Quelle'}
          </span>
          <button type="button" onClick={onReload} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface2 hover:text-ink" aria-label="Neu laden">
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

const MOBILE_MAIN: Section[] = ['dashboard', 'calendar', 'tasks', 'exams']

/**
 * Handy: schwebende weisse Kapsel unten. Nur die aktive Seite zeigt ihren Namen (Rosé-Pille),
 * rechts daneben der runde «+»-Knopf (wird von App gezeichnet, wenn withFab gesetzt ist).
 */
export function BottomBar({ active, onNavigate, onMore, badge, withFab }: { active: Section; onNavigate: (s: Section) => void; onMore: () => void; badge?: number; withFab?: boolean }) {
  const items = SECTIONS.filter((s) => MOBILE_MAIN.includes(s.id))
  const moreActive = !MOBILE_MAIN.includes(active)
  const btn = (on: boolean) =>
    `relative flex h-12 min-w-10 basis-0 items-center justify-center gap-1.5 rounded-full text-[12px] font-bold transition-all duration-200 ${on ? 'min-w-0 flex-[2.6] bg-accent/[0.15] px-2.5 text-accent' : 'flex-1 text-muted'}`
  return (
    <nav
      aria-label="Hauptnavigation"
      className={`fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-30 flex items-center gap-0.5 rounded-full bg-surface p-1.5 shadow-float md:hidden ${withFab ? 'right-[5.25rem]' : 'right-3'}`}
    >
      {items.map((s) => {
        const on = s.id === active
        return (
          <button key={s.id} type="button" onClick={() => onNavigate(s.id)} aria-current={on ? 'page' : undefined} aria-label={s.label} className={btn(on)}>
            <Icon name={s.icon} size={22} />
            {on && <span className="truncate max-[359px]:hidden">{s.id === 'dashboard' ? 'Heute' : s.label}</span>}
            {s.id === 'tasks' && !!badge && (
              <span className="tnum absolute right-1 top-0.5 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${badge} überfällig`}>{badge}</span>
            )}
          </button>
        )
      })}
      <button type="button" onClick={onMore} aria-current={moreActive ? 'page' : undefined} aria-label="Mehr" className={btn(moreActive)}>
        <Icon name="more" size={22} />
        {moreActive && <span className="truncate max-[359px]:hidden">Mehr</span>}
      </button>
    </nav>
  )
}
