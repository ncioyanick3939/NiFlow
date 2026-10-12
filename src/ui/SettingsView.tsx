import { useState } from 'react'
import { callIntervals } from '../sources/intervalsSource'

interface Props {
  connected: boolean
  onConnect: () => void
  /** Nach dem Speichern oder Entfernen eines Schlüssels: Termine neu laden. */
  onChanged: () => void
}

type Message = { kind: 'ok' | 'error'; text: string } | null

export default function SettingsView({ connected, onConnect, onChanged }: Props) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  const save = async () => {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const { status, body } = await callIntervals({ api_key: key.trim() })
      if (status === 200 && body.ok) {
        setKey('')
        setMessage({ kind: 'ok', text: 'Gespeichert und geprüft. Die Trainings werden geladen.' })
        onChanged()
      } else if (body.error === 'invalid_key') {
        setMessage({ kind: 'error', text: 'Intervals.icu lehnt diesen Schlüssel ab. Prüfe, ob er vollständig kopiert ist.' })
      } else {
        setMessage({ kind: 'error', text: `Speichern nicht möglich (${String(body.error ?? status)}).` })
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const { status, body } = await callIntervals({ remove: true })
      if (status === 200 && body.ok) {
        setMessage({ kind: 'ok', text: 'Schlüssel entfernt.' })
        onChanged()
      } else {
        setMessage({ kind: 'error', text: `Entfernen nicht möglich (${String(body.error ?? status)}).` })
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="border-b border-ink px-5 pb-4 pt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-ink/60">NiFlow</p>
        <h1 className="mt-1 text-4xl font-bold leading-none tracking-tight">Einstellungen</h1>
      </header>

      <section className="border-b border-ink/20 px-5 py-5">
        <h2 className="text-xl font-bold">Intervals.icu</h2>
        <p className="mt-1 text-sm text-ink/70">
          Zeigt deine geplanten Trainings und Wettkämpfe. Nur lesend. Bereits absolvierte Aktivitäten
          werden noch nicht geladen.
        </p>

        {!connected ? (
          <div className="mt-4">
            <p className="text-sm">Dafür musst du zuerst mit Google verbunden sein.</p>
            <button
              type="button"
              onClick={onConnect}
              className="mt-3 min-h-12 border border-ink bg-ink px-4 font-medium uppercase tracking-wider text-paper"
            >
              Mit Google verbinden
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/80">
              <li>Öffne Intervals.icu und gehe zu «Settings».</li>
              <li>Scrolle ganz nach unten zu «Developer Settings».</li>
              <li>Erzeuge einen «API Key» und kopiere ihn.</li>
              <li>Füge ihn unten ein.</li>
            </ol>
            <label className="block text-sm font-medium" htmlFor="intervals-key">
              API-Schlüssel
            </label>
            <input
              id="intervals-key"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="time min-h-12 w-full border border-ink bg-paper px-3"
              placeholder="Schlüssel hier einfügen"
            />
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !key.trim()}
                className="min-h-12 border border-ink bg-ink px-4 font-medium uppercase tracking-wider text-paper disabled:opacity-40"
              >
                {busy ? 'Prüft …' : 'Speichern und prüfen'}
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="min-h-12 font-medium underline underline-offset-4 disabled:opacity-40"
              >
                Schlüssel entfernen
              </button>
            </div>
            {message && (
              <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-signal' : 'text-ink'}`}>
                {message.text}
              </p>
            )}
            <p className="text-xs text-ink/50">
              Der Schlüssel wird nur auf dem Server in deiner geschützten Datenbank gespeichert und nie in der App angezeigt.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
