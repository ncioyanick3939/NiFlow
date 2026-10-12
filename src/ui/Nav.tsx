import { formatTime } from '../domain/dateUtils'
import type { SourceState } from '../sources/types'
import Icon from './icons'
import type { IconName } from './icons'

export type Section = 'dashboard' | 'calendar' | 'training' | 'settings'

export const SECTIONS: { id: Section; label: string; icon: IconName; hash: string }[] = [
  { id: 'dashboard', label: 'Übersicht', icon: 'dashboard', hash: 'uebersicht' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar', hash: 'kalender' },
  { id: 'training', label: 'Training', icon: 'activity', hash: 'training' },
  { id: 'settings', label: 'Einstellungen', icon: 'settings', hash: 'einstellungen' },
]

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-[8px] bg-accent text-accentink" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M4 15c3 0 4-6 8-6s5 6 8 6" />
        <path d="M4 20c3 0 4-3 8-3s5 3 8 3" opacity="0.55" />
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
}

export function Sidebar({ active, onNavigate, onCreate, states, loading, onReload }: Props) {
  const errors = states.filter((s) => s.status === 'error')
  const last = states
    .map((s) => s.lastSync)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <Logo />
        <span className="text-[17px] font-semibold tracking-tight">NiFlow</span>
      </div>
      {onCreate && (
        <button type="button" className="btn-primary mb-5 w-full justify-start" onClick={onCreate}>
          <Icon name="plus" size={16} /> Neuer Eintrag
        </button>
      )}
      <nav aria-label="Hauptnavigation" className="space-y-0.5">
        {SECTIONS.map((s) => {
          const on = s.id === active
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                on ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-surface2 hover:text-ink'
              }`}
            >
              <Icon name={s.icon} size={18} />
              {s.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${errors.length > 0 ? 'bg-danger' : loading ? 'animate-pulse bg-muted' : 'bg-[rgb(var(--study))]'}`} aria-hidden="true" />
          <span className="mr-auto">
            {loading ? 'Synchronisiert …' : errors.length > 0 ? `${errors.length} Quelle${errors.length > 1 ? 'n' : ''} mit Fehler` : last ? `Aktuell · ${formatTime(last)}` : 'Keine Quelle'}
          </span>
          <button type="button" onClick={onReload} disabled={loading} className="btn-ghost h-8 min-h-8 w-8 px-0" aria-label="Neu laden">
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export function BottomBar({ active, onNavigate }: { active: Section; onNavigate: (s: Section) => void }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {SECTIONS.map((s) => {
        const on = s.id === active
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${on ? 'text-accent' : 'text-muted'}`}
          >
            <Icon name={s.icon} size={22} />
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
