import { formatClock } from '../../domain/timer'
import type { TimerState } from '../../domain/timer'
import Icon from '../icons'

/** Kleine Anzeige, solange der Timer läuft oder pausiert: Tippen öffnet den Timer. */
export default function TimerPill({ state, rest, onOpen }: { state: TimerState; rest: number; onOpen: () => void }) {
  if (state.status !== 'running' && state.status !== 'paused') return null
  const label = state.phase === 'focus' ? 'Fokus' : 'Pause'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Timer öffnen: ${label}, noch ${formatClock(rest)}${state.status === 'paused' ? ', pausiert' : ''}`}
      className="fixed left-5 z-30 flex h-12 items-center gap-2 rounded-full bg-deep px-4 text-deepink shadow-float transition-transform duration-150 active:scale-95 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6"
    >
      <Icon name="timer" size={18} />
      <span className="tnum text-[15px] font-bold">{formatClock(rest)}</span>
      <span className="text-xs font-semibold opacity-70">{state.status === 'paused' ? 'Pausiert' : label}</span>
    </button>
  )
}
