import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatTime } from '../domain/dateUtils'
import { callIntervals } from '../sources/intervalsSource'
import { callPush } from '../data/googlePush'
import type { PushStatus } from '../data/googlePush'
import { useNotifyPermission } from './reminders'
import type { SourceState } from '../sources/types'
import Icon from './icons'
import { Segmented } from './kit'
import type { ThemeChoice } from './theme'

interface Props {
  email: string | null
  demo: boolean
  states: SourceState[]
  theme: ThemeChoice
  onTheme: (t: ThemeChoice) => void
  onConnect: () => void
  onSignOut: () => void
  onChanged: () => void
  push: PushStatus | null
  onPush: (s: PushStatus) => void
}

type Message = { kind: 'ok' | 'error'; text: string } | null

export default function SettingsView({ email, demo, states, theme, onTheme, onConnect, onSignOut, onChanged, push, onPush }: Props) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const state = (id: string) => states.find((s) => s.id === id)
  const notify = useNotifyPermission()
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<{ kind: "ok" | "error"; text: string; reconnect?: boolean } | null>(null)

  const runPush = async (payload: Record<string, unknown>, done: (r: Record<string, unknown>) => string) => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const r = await callPush(payload)
      setPushMsg({ kind: 'ok', text: done(r) })
      const status = await callPush<PushStatus>({ action: 'status' })
      onPush(status)
    } catch (err) {
      const code = (err as { code?: string }).code
      setPushMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Fehler', reconnect: code === 'reauth' || code === 'scope_missing' })
    } finally {
      setPushBusy(false)
    }
  }
  const summary = (r: Record<string, unknown>) =>
    `${Number(r.pushed ?? 0)} Termine übertragen${Number(r.removed ?? 0) ? `, ${Number(r.removed)} entfernt` : ''}${Number(r.failed ?? 0) ? `, ${Number(r.failed)} fehlgeschlagen` : ''}.`

  const run = async (payload: Record<string, unknown>, ok: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const { status, body } = await callIntervals(payload)
      if (status === 200 && body.ok) {
        setKey('')
        setMessage({ kind: 'ok', text: ok })
        onChanged()
      } else if (body.error === 'invalid_key') {
        setMessage({ kind: 'error', text: 'Intervals.icu lehnt diesen Schlüssel ab. Prüfe, ob er vollständig kopiert ist.' })
      } else {
        setMessage({ kind: 'error', text: `Nicht möglich (${String(body.error ?? status)}${body.status ? ', ' + String(body.status) : ''}).` })
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <h1 className="mb-8 text-[1.75rem] font-semibold leading-tight tracking-tight">Einstellungen</h1>

      <Group title="Konto">
        {email ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{email[0]?.toUpperCase()}</span>
            <div className="mr-auto min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-muted">Angemeldet mit Google</p>
            </div>
            <button type="button" className="btn-outline" onClick={onSignOut}>
              <Icon name="logout" size={16} /> Abmelden
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm text-muted">{demo ? 'Du siehst die Demo mit erfundenen Daten.' : 'Nicht angemeldet.'}</p>
            <button type="button" className="btn-primary" onClick={onConnect}>
              Mit Google anmelden
            </button>
          </div>
        )}
      </Group>

      <Group title="Darstellung">
        <Segmented
          label="Farbschema"
          value={theme}
          onChange={onTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Hell' },
            { value: 'dark', label: 'Dunkel' },
          ]}
        />
      </Group>

      {email && (
        <Group title="Datenquellen">
          <div className="divide-y divide-line">
            <SourceLine name="Eigene Einträge" detail="Gespeichert in deiner geschützten Datenbank" s={state('own')} />
            <SourceLine
              name="Google Kalender"
              detail="Nur lesen. Eigene Einträge in Google eintragen folgt."
              s={state('google')}
              action={state('google')?.status === 'error' && <button type="button" className="btn-outline min-h-9 text-xs" onClick={onConnect}>Neu verbinden</button>}
            />
            <div className="py-4">
              <SourceLine name="Intervals.icu" detail="Geplante Trainings und Wettkämpfe, nur lesen" s={state('intervals')} bare />
              <div className="mt-3 space-y-2">
                <label className="label" htmlFor="intervals-key">
                  API-Schlüssel {state('intervals') ? 'ersetzen' : 'hinterlegen'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="intervals-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="field max-w-sm flex-1"
                    placeholder="Intervals.icu → Settings → Developer Settings"
                  />
                  <button type="button" className="btn-primary" disabled={busy || !key.trim()} onClick={() => void run({ api_key: key.trim() }, 'Gespeichert und geprüft. Die Trainings werden geladen.')}>
                    {busy ? 'Prüft …' : 'Speichern'}
                  </button>
                  {state('intervals') && (
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void run({ remove: true }, 'Schlüssel entfernt.')}>
                      Entfernen
                    </button>
                  )}
                </div>
                {message && (
                  <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
                    {message.text}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Icon name="lock" size={12} /> Der Schlüssel wird nur auf dem Server gespeichert und nie angezeigt.
                </p>
              </div>
            </div>
          </div>
        </Group>
      )}

      {email && (
        <Group title="In Google eintragen">
          <p className="mb-3 text-sm text-muted">
            Deine eigenen Termine (nicht Notizen und Aufgaben) erscheinen in einem eigenen Google-Kalender «NiFlow». Deine übrigen
            Google-Kalender werden nie verändert. Richtung: nur von NiFlow zu Google. Änderungen bitte in NiFlow machen.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {push?.enabled ? (
              <>
                <span className="mr-auto flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--study))]" aria-hidden="true" />
                  Aktiv{push.lastPushAt ? ` · zuletzt abgeglichen ${formatTime(new Date(push.lastPushAt))} Uhr` : ''}
                </span>
                <button type="button" className="btn-outline" disabled={pushBusy} onClick={() => void runPush({ action: 'sync_all' }, summary)}>
                  <Icon name="refresh" size={16} /> {pushBusy ? 'Gleicht ab …' : 'Jetzt abgleichen'}
                </button>
                <button type="button" className="btn-ghost" disabled={pushBusy} onClick={() => void runPush({ action: 'disable' }, () => 'Ausgeschaltet. Der Kalender «NiFlow» bleibt in Google bestehen.')}>
                  Ausschalten
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-primary" disabled={pushBusy} onClick={() => void runPush({ action: 'enable' }, (r) => `Eingeschaltet. ${summary(r)}`)}>
                  {pushBusy ? 'Richtet ein …' : 'Einschalten'}
                </button>
                {push?.hasCalendar && (
                  <button type="button" className="btn-ghost text-danger" disabled={pushBusy} onClick={() => void runPush({ action: 'disable', remove_calendar: true }, () => 'Kalender «NiFlow» in Google gelöscht.')}>
                    Kalender «NiFlow» in Google löschen
                  </button>
                )}
              </>
            )}
          </div>
          {pushMsg && (
            <p role={pushMsg.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${pushMsg.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
              {pushMsg.text}{' '}
              {pushMsg.reconnect && (
                <button type="button" className="font-medium text-accent hover:underline" onClick={onConnect}>
                  Neu verbinden
                </button>
              )}
            </p>
          )}
        </Group>
      )}

      {email && (
        <Group title="Erinnerungen">
          <p className="mb-3 text-sm text-muted">
            Erinnerungen stellst du bei Terminen und Aufgaben ein. Sie erscheinen, solange NiFlow in einem Browser-Tab geöffnet ist. Bei
            geschlossener App kommen noch keine Erinnerungen.
          </p>
          {notify.state === 'granted' ? (
            <p className="flex items-center gap-2 text-sm">
              <Icon name="check" size={16} className="text-accent" /> Benachrichtigungen sind erlaubt.
            </p>
          ) : notify.state === 'denied' ? (
            <p className="text-sm text-muted">Benachrichtigungen sind im Browser blockiert. Erinnerungen erscheinen deshalb nur als Hinweis in NiFlow.</p>
          ) : notify.state === 'unsupported' ? (
            <p className="text-sm text-muted">Dieser Browser unterstützt keine Benachrichtigungen. Erinnerungen erscheinen als Hinweis in NiFlow.</p>
          ) : (
            <button type="button" className="btn-outline" onClick={() => void notify.request()}>
              Benachrichtigungen erlauben
            </button>
          )}
        </Group>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 grid gap-3 border-t border-line pt-5 md:grid-cols-[11rem,1fr] md:gap-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function SourceLine({ name, detail, s, action, bare }: { name: string; detail: string; s?: SourceState; action?: ReactNode; bare?: boolean }) {
  const status = !s ? 'off' : s.status
  return (
    <div className={`flex flex-wrap items-center gap-3 ${bare ? '' : 'py-4'}`}>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === 'ok' ? 'bg-[rgb(var(--study))]' : status === 'error' ? 'bg-danger' : 'bg-line'}`}
        aria-hidden="true"
      />
      <div className="mr-auto min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted">
          {status === 'ok' && s?.lastSync ? `Zuletzt geladen ${formatTime(s.lastSync)} Uhr · ${s.count} Einträge` : status === 'error' ? s?.error : 'Nicht eingerichtet'}
          {status !== 'error' && <span className="block">{detail}</span>}
        </p>
      </div>
      {action}
    </div>
  )
}
