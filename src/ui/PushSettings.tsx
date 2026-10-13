import { useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush, needsHomeScreen, pushReasonText, pushSupported, testPush } from '../data/webPush'
import Icon from './icons'
import { useNotifyPermission } from './reminders'

type Msg = { kind: 'ok' | 'error'; text: string } | null

/** Einstellungen → Erinnerungen: bei geschlossener App (Web Push) und solange NiFlow offen ist. */
export default function PushSettings() {
  const notify = useNotifyPermission()
  const supported = pushSupported()
  const homeScreen = supported || typeof window === 'undefined' ? false : needsHomeScreenSafe()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    if (!supported) return setOn(false)
    void currentSubscription()
      .then((s) => setOn(!!s))
      .catch(() => setOn(false))
  }, [supported])

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    setMsg(null)
    try {
      setMsg({ kind: 'ok', text: await fn() })
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Nicht möglich.' })
    } finally {
      setBusy(false)
      if (supported) setOn(!!(await currentSubscription().catch(() => null)))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Erinnerungen stellst du bei Terminen und Aufgaben ein, zum Beispiel «15 Minuten vorher».</p>

      <div className="rounded-2xl bg-surface2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? 'bg-accent text-accentink' : 'bg-surface text-muted'}`}>
            <Icon name="bell" size={18} />
          </span>
          <div className="mr-auto min-w-0">
            <p className="text-sm font-medium">Auch bei geschlossener App</p>
            <p className="text-xs text-muted">{on ? 'Auf diesem Gerät eingeschaltet.' : 'Auf diesem Gerät aus.'}</p>
          </div>
          {supported &&
            (on ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline min-h-10"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await testPush()
                      if (r.sent > 0) return 'Test verschickt. Er sollte in wenigen Sekunden erscheinen.'
                      throw new Error(pushReasonText(r.reasons?.[0]))
                    })
                  }
                >
                  Test senden
                </button>
                <button type="button" className="btn-ghost min-h-10" disabled={busy} onClick={() => void run(async () => (await disablePush(), 'Auf diesem Gerät ausgeschaltet.'))}>
                  Ausschalten
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary min-h-10" disabled={busy || on === null} onClick={() => void run(async () => (await enablePush(), 'Eingeschaltet. Tippe auf «Test senden», um es auszuprobieren.'))}>
                Einschalten
              </button>
            ))}
        </div>
        {!supported && (
          <p className="mt-3 text-sm text-muted">
            {homeScreen
              ? 'Auf dem iPhone geht das nur, wenn NiFlow auf dem Home-Bildschirm liegt: In Safari auf «Teilen» tippen, dann «Zum Home-Bildschirm». NiFlow von dort öffnen und hier einschalten.'
              : 'Dieser Browser unterstützt keine Push-Benachrichtigungen.'}
          </p>
        )}
        {supported && !on && (
          <p className="mt-3 text-xs text-muted">Dafür liegen Titel und Uhrzeit deiner Erinnerungen der nächsten zwei Wochen in deiner Supabase-Datenbank. Öffne NiFlow ab und zu, damit neue dazukommen.</p>
        )}
        {msg && (
          <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {!on && (
        <div className="text-sm">
          <p className="mb-2 text-muted">Solange NiFlow offen ist, erscheinen Erinnerungen immer als Hinweis in der App.</p>
          {notify.state === 'granted' ? (
            <p className="flex items-center gap-2">
              <Icon name="check" size={16} className="text-accent" /> Benachrichtigungen sind erlaubt.
            </p>
          ) : notify.state === 'denied' ? (
            <p className="text-muted">Benachrichtigungen sind im Browser blockiert.</p>
          ) : notify.state === 'unsupported' ? null : (
            <button type="button" className="btn-outline" onClick={() => void notify.request()}>
              Benachrichtigungen erlauben
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function needsHomeScreenSafe(): boolean {
  try {
    return needsHomeScreen()
  } catch {
    return false
  }
}
