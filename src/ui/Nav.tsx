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

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-[30%] bg-sun text-deep" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M3 10c3 0 3.5-3 6-3s3.5 3 6 3 3.5-3 6-3" />
        <path d="M3 16c3 0 3.5-3 6-3s3.5 3 6 3 3.5-3 6-3" opacity="0.5" />
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
        className={`group relative flex min-h-11 w-full items-center justify-center gap-3 rounded-full px-3.5 text-[15px] transition-colors xl:justify-start ${
          on ? 'bg-deepink/[0.12] font-semibold text-deepink' : 'text-deepmuted hover:bg-deepink/[0.06] hover:text-deepink'
        }`}
      >
        {on && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sun" aria-hidden="true" />}
        <Icon name={s.icon} size={19} />
        <span className="mr-auto hidden xl:inline">{s.label}</span>
        {s.id === 'tasks' && !!badge && (
          <span className="tnum absolute right-2 top-1 rounded-full bg-sun px-1.5 text-[10px] font-bold leading-4 text-sunink xl:static xl:px-2 xl:text-[11px] xl:leading-5">{badge}</span>
        )}
      </button>
    )
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col bg-deep px-3 pb-5 pt-6 text-deepink md:flex xl:w-[248px] xl:px-4">
      <div className="mb-7 flex items-center justify-center gap-3 px-2 xl:justify-start">
        <Logo size={34} />
        <span className="hidden font-display text-[21px] font-semibold tracking-tight xl:inline">NiFlow</span>
      </div>
      {onCreate && (
        <button type="button" className="btn-sun mb-3 w-full px-0 xl:px-4" onClick={onCreate} title="Neu erstellen" aria-label="Neu erstellen">
          <Icon name="plus" size={18} /> <span className="hidden xl:inline">Neu erstellen</span>
        </button>
      )}
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          title="Suchen (Strg+K)"
          aria-label="Suchen"
          className="mb-6 flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-deepink/15 px-3.5 text-sm text-deepmuted transition-colors hover:border-deepink/30 hover:text-deepink xl:justify-start"
        >
          <Icon name="search" size={17} />
          <span className="mr-auto hidden xl:inline">Suchen</span>
          <kbd className="hidden rounded-md bg-deepink/10 px-1.5 text-[11px] font-medium xl:inline">Strg K</kbd>
        </button>
      )}
      <nav aria-label="Hauptnavigation" className="space-y-1">
        {main.map(item)}
      </nav>
      <div className="mt-auto space-y-3">
        {item(settings)}
        <div className="flex flex-col items-center gap-2 text-xs text-deepmuted xl:flex-row xl:px-3.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${errors.length > 0 ? 'bg-[rgb(var(--danger))]' : loading ? 'animate-pulse bg-deepmuted' : 'bg-sun'}`} aria-hidden="true" />
          <span className="mr-auto hidden xl:inline">
            {loading ? 'Lädt …' : errors.length > 0 ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} mit Fehler` : last ? `Aktuell, ${formatTime(last)} Uhr` : 'Keine Quelle'}
          </span>
          <button type="button" onClick={onReload} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-deepink/10" aria-label="Neu laden">
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
      className="fixed inset-x-0 bottom-0 z-30 flex bg-deep pb-[env(safe-area-inset-bottom)] text-deepink md:hidden"
    >
      {items.map((s) => {
        const on = s.id === active
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            aria-current={on ? 'page' : undefined}
            className={`relative flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${on ? 'text-sun' : 'text-deepmuted'}`}
          >
            <Icon name={s.icon} size={22} />
            {s.label}
            {s.id === 'tasks' && !!badge && (
              <span className="tnum absolute left-1/2 top-2 ml-2 rounded-full bg-sun px-1.5 text-[10px] font-bold leading-4 text-sunink">{badge}</span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        aria-current={moreActive ? 'page' : undefined}
        className={`flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${moreActive ? 'text-sun' : 'text-deepmuted'}`}
      >
        <Icon name="more" size={22} />
        Mehr
      </button>
    </nav>
  )
}
