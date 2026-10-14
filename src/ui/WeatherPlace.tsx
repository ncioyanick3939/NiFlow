import { useState } from 'react'
import type { FormEvent } from 'react'
import { searchPlaces } from '../data/weather'
import type { WeatherPlace as Place } from '../domain/weather'
import Icon from './icons'

interface Props {
  place: Place | null
  onChange: (p: Place | null) => void
  /** Kompakte Darstellung (im Assistenten) */
  compact?: boolean
}

/** Ort für das Wetter wählen. Gesucht wird bei Open-Meteo; gespeichert wird nur auf diesem Gerät. */
export default function WeatherPlace({ place, onChange, compact }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await searchPlaces(query)
      setResults(r)
      if (r.length === 0) setError('Keinen Ort gefunden. Versuche den Namen einer Stadt in der Nähe.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suche fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {place && (
        <div className="flex items-center gap-2">
          <p className="mr-auto min-w-0 truncate text-sm font-medium">
            <Icon name="cloud" size={14} className="mr-1 inline text-muted" />
            {place.name}
          </p>
          <button type="button" className="btn-ghost min-h-9 text-xs text-muted" onClick={() => onChange(null)}>
            Entfernen
          </button>
        </div>
      )}
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={place ? 'Anderen Ort suchen' : 'Ort suchen, z. B. Bern'}
          aria-label="Ort für das Wetter"
          className={`field min-w-0 flex-1 ${compact ? 'min-h-10 text-sm' : ''}`}
          autoComplete="off"
        />
        <button type="submit" className="btn-outline min-h-10" disabled={busy || query.trim().length < 2}>
          {busy ? 'Sucht …' : 'Suchen'}
        </button>
      </form>
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
      {results && results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                className="min-h-11 w-full px-3 text-left text-sm hover:bg-surface2"
                onClick={() => {
                  onChange(r)
                  setResults(null)
                  setQuery('')
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
