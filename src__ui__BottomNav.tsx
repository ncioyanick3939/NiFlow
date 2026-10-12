import type { ReactElement } from 'react'

export type Tab = 'today' | 'week'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const ITEMS: { id: Tab; label: string; icon: ReactElement }[] = [
  {
    id: 'today',
    label: 'Heute',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    id: 'week',
    label: 'Woche',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="15" />
        <path d="M3 10h18M9 5v15M15 5v15" />
      </svg>
    ),
  },
]

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="flex border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      {ITEMS.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium uppercase tracking-wider ${
              isActive ? 'text-ink' : 'text-ink/50'
            }`}
          >
            {isActive && <span className="absolute inset-x-0 top-0 h-[3px] bg-signal" />}
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
