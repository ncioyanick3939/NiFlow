import { formatTime } from '../domain/dateUtils'
import type { SourceState } from '../sources/types'

interface Props {
  states: SourceState[]
  loading: boolean
  onReload: () => void
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
}

/** Zeigt ehrlich an, woher die Daten stammen und ob die letzte Ladung geklappt hat. */
export default function SourceStatus({ states, loading, onReload, connected, onConnect, onDisconnect }: Props) {
  const hasDemo = states.some((s) => s.isDemo)
  const errors = states.filter((s) => s.status === 'error')

  return (
    <div className="border-b border-ink/20 px-5 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {hasDemo && (
            <span className="shrink-0 border border-signal px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wider text-signal">
              Testdaten
            </span>
          )}
          <span className="truncate text-ink/60">
            {hasDemo
              ? 'Erfundene Beispieltermine, keine echte Synchronisation'
              : states.length === 0
                ? 'Keine Quelle verbunden'
                : 'Echte Daten aus Google Kalender (nur lesend)'}
          </span>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          className="min-h-12 shrink-0 px-2 font-medium underline underline-offset-4 disabled:opacity-40"
        >
          {loading ? 'Lädt …' : 'Neu laden'}
        </button>
      </div>
      <div className="-mt-1 pb-1">
        {connected ? (
          <div className="flex items-center gap-4">
            {errors.length > 0 && (
              <button
                type="button"
                onClick={onConnect}
                className="min-h-12 border border-ink bg-ink px-4 font-medium uppercase tracking-wider text-paper"
              >
                Neu verbinden
              </button>
            )}
            <button type="button" onClick={onDisconnect} className="min-h-12 font-medium underline underline-offset-4">
              Google trennen
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="min-h-12 border border-ink bg-ink px-4 font-medium uppercase tracking-wider text-paper"
          >
            Mit Google verbinden
          </button>
        )}
      </div>
      {states
        .filter((s) => s.lastSync)
        .map((s) => (
          <p key={s.id} className="time -mt-2 pb-1 text-[11px] text-ink/50">
            {s.label}: zuletzt geladen {formatTime(s.lastSync!)} Uhr, {s.count} Termine
          </p>
        ))}
      {errors.map((s) => (
        <p key={s.id} role="alert" className="pb-1 text-signal">
          {s.label} konnte nicht geladen werden: {s.error}
        </p>
      ))}
    </div>
  )
}
