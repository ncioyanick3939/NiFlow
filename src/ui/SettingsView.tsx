import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatTime } from '../domain/dateUtils'
import { DELETE_WORD, deleteConfirmed } from '../domain/authText'
import { callIntervals } from '../sources/intervalsSource'
import { callPush } from '../data/googlePush'
import type { PushStatus } from '../data/googlePush'
import { DASH_LABEL } from './hooks'
import type { DashSection } from './hooks'
import type { SourceState } from '../sources/types'
import Icon from './icons'
import { Segmented } from './kit'
import Page from './Page'
import PushSettings from './PushSettings'
import LabelsEditor from './LabelsEditor'
import LegalLinks from './LegalLinks'
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
  dash: Record<DashSection, boolean>
  onDash: (k: DashSection) => void
  onLabelsChanged: (deleted: boolean) => Promise<void>
  /** Konto hat eine Google-Anmeldung (Kalender-Verbindung möglich) */
  hasGoogle: boolean
  /** Einwilligung zum KI-Planer und Widerruf */
  aiConsent: boolean
  onRevokeAi: () => void
  /** Löscht das Konto samt Daten. Wirft bei Fehlern. */
  onDeleteAccount: () => Promise<void>
}

type Message = { kind: 'ok' | 'error'; text: string } | null

export default function SettingsView({ email, demo, states, theme, onTheme, onConnect, onSignOut, onChanged, push, onPush, dash, onDash, onLabelsChanged, hasGoogle, aiConsent, onRevokeAi, onDeleteAccount }: Props) {
  const [confirmOut, setConfirmOut] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const state = (id: string) => states.find((s) => s.id === id)
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
    <Page title="Einstellungen" sub={email ? `Angemeldet als ${email}` : demo ? 'Demo-Modus' : undefined} width="narrow">
      <div className="space-y-4">

      <Group title="Konto">
        {email ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accentink">{email[0]?.toUpperCase()}</span>
            <div className="mr-auto min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-muted">{hasGoogle ? 'Angemeldet mit Google' : 'Angemeldet mit E-Mail und Passwort'}</p>
            </div>
            {confirmOut ? (
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost" onClick={() => setConfirmOut(false)}>
                  Abbrechen
                </button>
                <button type="button" className="btn-primary" onClick={onSignOut} autoFocus>
                  <Icon name="logout" size={16} /> Ja, abmelden
                </button>
              </div>
            ) : (
              <button type="button" className="btn-outline" onClick={() => setConfirmOut(true)}>
                <Icon name="logout" size={16} /> Abmelden
              </button>
            )}
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

      {(email || demo) && (
        <Group title="Kategorien">
          <LabelsEditor readOnly={!email} onChanged={onLabelsChanged} />
        </Group>
      )}

      <Group title="Übersicht">
        <p className="mb-2 text-sm text-muted">Welche Bereiche die Übersicht zeigt. Gilt für diesen Browser.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {(Object.keys(DASH_LABEL) as DashSection[]).map((k) => (
            <label key={k} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" checked={dash[k]} onChange={() => onDash(k)} />
              {DASH_LABEL[k]}
            </label>
          ))}
        </div>
      </Group>

      {email && (
        <Group title="Datenquellen">
          <div className="divide-y divide-line">
            <SourceLine name="Eigene Einträge" detail="Gespeichert in deiner geschützten Datenbank" s={state('own')} />
            <SourceLine
              name="Google Kalender"
              detail={hasGoogle ? 'Termine aus deinen Google-Kalendern, nur lesen.' : 'Nicht verbunden. Melde dich dafür mit Google an, am besten mit derselben E-Mail-Adresse wie bei NiFlow.'}
              s={state('google')}
              action={
                (!hasGoogle || state('google')?.status === 'error') && (
                  <button type="button" className="btn-outline min-h-9 text-xs" onClick={onConnect}>
                    {hasGoogle ? 'Neu verbinden' : 'Mit Google verbinden'}
                  </button>
                )
              }
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

      {email && hasGoogle && (
        <Group title="In Google eintragen">
          <p className="mb-3 text-sm text-muted">
            Deine eigenen Termine (nicht Notizen und Aufgaben) erscheinen in einem eigenen Google-Kalender «NiFlow». Deine übrigen
            Google-Kalender werden nie verändert. Richtung: nur von NiFlow zu Google. Änderungen bitte in NiFlow machen.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {push?.enabled ? (
              <>
                <span className="mr-auto flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--private))]" aria-hidden="true" />
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
          <PushSettings />
        </Group>
      )}

      <Group title="Datenschutz">
        <LegalLinks className="text-sm" />
        {email && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <div className="mr-auto min-w-0">
              <p className="text-sm font-medium">Planungs-Assistent (KI)</p>
              <p className="text-xs text-muted">{aiConsent ? 'Du hast der Weitergabe an die KI zugestimmt.' : 'Noch nicht aktiviert. Beim ersten Öffnen fragen wir dich um Erlaubnis.'}</p>
            </div>
            {aiConsent && (
              <button type="button" className="btn-outline min-h-9 text-xs" onClick={onRevokeAi}>
                Einwilligung widerrufen
              </button>
            )}
          </div>
        )}
      </Group>

      {email && <DeleteAccount email={email} onDelete={onDeleteAccount} />}
      </div>
    </Page>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-3xl bg-surface p-5 shadow-card md:grid-cols-[11rem,minmax(0,1fr)] md:gap-10 md:p-6">
      <h2 className="h-section">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function SourceLine({ name, detail, s, action, bare }: { name: string; detail: string; s?: SourceState; action?: ReactNode; bare?: boolean }) {
  const status = !s ? 'off' : s.status
  return (
    <div className={`flex flex-wrap items-center gap-3 ${bare ? '' : 'py-4'}`}>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === 'ok' ? 'bg-[rgb(var(--private))]' : status === 'error' ? 'bg-danger' : 'bg-line'}`}
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

/** Konto löschen: Erklärung, Bestätigungswort tippen, dann endgültig. */
function DeleteAccount({ email, onDelete }: { email: string; onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Group title="Konto löschen">
      <p className="text-sm text-muted">
        Löscht dein Konto <span className="font-medium text-ink">{email}</span> und alle Daten dauerhaft: Termine, Aufgaben, Prüfungen, Kategorien, gespeicherte Schlüssel und
        Erinnerungen. Das kann nicht rückgängig gemacht werden. Der Kalender «NiFlow» in deinem Google-Konto bleibt bestehen. Lösche ihn vorher unter «In Google eintragen», wenn du das möchtest.
      </p>
      {!open ? (
        <button type="button" className="btn-outline mt-3 text-danger" onClick={() => setOpen(true)}>
          <Icon name="trash" size={16} /> Konto löschen …
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!deleteConfirmed(word) || busy) return
            setBusy(true)
            setError(null)
            try {
              await onDelete()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Das Konto konnte nicht gelöscht werden.')
              setBusy(false)
            }
          }}
        >
          <label className="label" htmlFor="delete-word">
            Tippe «{DELETE_WORD}», um zu bestätigen
          </label>
          <div className="flex flex-wrap gap-2">
            <input id="delete-word" className="field max-w-[12rem]" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <button type="submit" className="btn bg-danger text-white hover:brightness-105" disabled={!deleteConfirmed(word) || busy}>
              {busy ? 'Löscht …' : 'Endgültig löschen'}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setOpen(false); setWord(''); setError(null) }}>
              Abbrechen
            </button>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </form>
      )}
    </Group>
  )
}
