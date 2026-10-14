import { isNativeApp } from '../lib/platform'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorText, validateCredentials, validateNewPassword } from '../domain/authText'
import type { AuthMode } from '../domain/authText'
import { sendPasswordReset, setNewPassword, signInWithEmail, signUpWithEmail } from '../lib/supabase'
import Icon from './icons'
import type { IconName } from './icons'
import LegalLinks from './LegalLinks'
import { Logo } from './Nav'

interface Props {
  onGoogle: () => void
  onDemo: () => void
  /** Die Person hat den Link «Passwort zurücksetzen» geöffnet und wählt ein neues Passwort. */
  recovery?: boolean
  onRecoveryDone?: () => void
}

type Note = { kind: 'ok' | 'error'; text: string } | null

const MODE_TITLE: Record<AuthMode, string> = { login: 'Mit E-Mail anmelden', register: 'Konto erstellen', reset: 'Passwort zurücksetzen' }

/** Startseite ohne Anmeldung: freundlich, ein klarer Hauptknopf, vier farbige Bereiche. */
export default function Welcome({ onGoogle, onDemo, recovery, onRecoveryDone }: Props) {
  const native = isNativeApp()
  const today = new Date()
  const [mode, setMode] = useState<AuthMode | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)

  const open = (m: AuthMode | null) => {
    setMode(m)
    setNote(null)
    setPassword('')
    setRepeat('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!mode || busy) return
    const problem = validateCredentials(mode, email, password, repeat)
    if (problem) return setNote({ kind: 'error', text: problem })
    setBusy(true)
    setNote(null)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else if (mode === 'register') {
        const confirm = await signUpWithEmail(email, password)
        if (confirm) setNote({ kind: 'ok', text: 'Fast geschafft: Wir haben dir eine E-Mail geschickt. Öffne den Link darin, dann bist du angemeldet.' })
      } else {
        await sendPasswordReset(email)
        setNote({ kind: 'ok', text: 'Falls es dazu ein Konto gibt, ist eine E-Mail mit einem Link unterwegs.' })
      }
    } catch (err) {
      setNote({ kind: 'error', text: authErrorText(err instanceof Error ? err.message : undefined) })
    } finally {
      setBusy(false)
    }
  }

  const saveNewPassword = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validateNewPassword(password, repeat)
    if (problem) return setNote({ kind: 'error', text: problem })
    setBusy(true)
    setNote(null)
    try {
      await setNewPassword(password)
      onRecoveryDone?.()
    } catch (err) {
      setNote({ kind: 'error', text: authErrorText(err instanceof Error ? err.message : undefined) })
    } finally {
      setBusy(false)
    }
  }

  const noteView = note && (
    <p role={note.kind === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm font-medium ${note.kind === 'error' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-ink'}`}>
      {note.text}
    </p>
  )

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">NiFlow</span>
        </div>

        {recovery ? (
          <form onSubmit={saveNewPassword} className="mt-10 space-y-3" noValidate>
            <h1 className="h-display text-[30px] leading-tight">Neues Passwort wählen</h1>
            <p className="text-[15px] text-muted">Wähle ein Passwort mit mindestens 8 Zeichen.</p>
            <div>
              <label className="label" htmlFor="new-pw">Neues Passwort</label>
              <input id="new-pw" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="new-pw2">Passwort wiederholen</label>
              <input id="new-pw2" type="password" autoComplete="new-password" className="field" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </div>
            {noteView}
            <button type="submit" className="btn-primary min-h-12 w-full rounded-2xl" disabled={busy}>
              {busy ? 'Speichert …' : 'Passwort speichern'}
            </button>
          </form>
        ) : (
          <>
            <p className="chip mt-10 bg-accent/10 text-accent">
              {today.toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
            <h1 className="h-display mt-4 text-[38px] leading-[1.05] md:text-[48px]">Studium, Training und Alltag <span className="text-accent">in einem Plan.</span></h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              NiFlow zeigt dir, was heute zählt, wo du freie Zeit hast und was als Nächstes kommt. Mit eigenem Kalender, Aufgaben, Prüfungen und
              deinen Daten aus Google Kalender und Intervals.icu.
            </p>

            {!mode ? (
              <div className="mt-8 space-y-2">
                {!native && (
                  <button type="button" className="btn-primary min-h-12 w-full rounded-2xl" onClick={onGoogle}>
                    Mit Google anmelden
                  </button>
                )}
                <button type="button" className={`${native ? 'btn-primary' : 'btn-outline'} min-h-12 w-full rounded-2xl`} onClick={() => open('login')}>
                  <Icon name="mail" size={18} /> Mit E-Mail anmelden
                </button>
                <button type="button" className="btn-ghost min-h-11 w-full rounded-2xl text-muted" onClick={onDemo}>
                  Zuerst die Demo ansehen
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-3 rounded-3xl bg-surface p-5 shadow-card" noValidate>
                <div className="flex items-center gap-2">
                  <button type="button" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface2" onClick={() => open(null)} aria-label="Zurück">
                    <Icon name="chevronLeft" size={20} />
                  </button>
                  <h2 className="h-section">{MODE_TITLE[mode]}</h2>
                </div>
                <div>
                  <label className="label" htmlFor="auth-email">E-Mail</label>
                  <input id="auth-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode !== 'reset' && (
                  <div>
                    <label className="label" htmlFor="auth-pw">Passwort</label>
                    <input id="auth-pw" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                )}
                {mode === 'register' && (
                  <div>
                    <label className="label" htmlFor="auth-pw2">Passwort wiederholen</label>
                    <input id="auth-pw2" type="password" autoComplete="new-password" className="field" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
                  </div>
                )}
                {noteView}
                <button type="submit" className="btn-primary min-h-12 w-full rounded-2xl" disabled={busy}>
                  {busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Link senden'}
                </button>
                {mode === 'register' && (
                  <p className="text-xs text-muted">
                    Mit dem Erstellen eines Kontos akzeptierst du die{' '}
                    <a href="./nutzungsbedingungen.html" target="_blank" rel="noopener" className="underline underline-offset-2">Nutzungsbedingungen</a> und nimmst die{' '}
                    <a href="./datenschutz.html" target="_blank" rel="noopener" className="underline underline-offset-2">Datenschutzerklärung</a> zur Kenntnis.
                  </p>
                )}
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 pt-1 text-sm">
                  {mode === 'login' && (
                    <>
                      <button type="button" className="min-h-9 font-medium text-accent hover:underline" onClick={() => open('register')}>Neues Konto erstellen</button>
                      <button type="button" className="min-h-9 text-muted hover:text-ink" onClick={() => open('reset')}>Passwort vergessen?</button>
                    </>
                  )}
                  {mode !== 'login' && (
                    <button type="button" className="min-h-9 font-medium text-accent hover:underline" onClick={() => open('login')}>Ich habe schon ein Konto</button>
                  )}
                </div>
              </form>
            )}

            <div className="mt-10 grid grid-cols-2 gap-3">
              {(
                [
                  ['Kalender', 'Monat, Woche, Tag und Agenda', 'calendar', 'cat-work'],
                  ['Aufgaben', 'Heute, als Nächstes, Inbox', 'tasks', 'cat-private'],
                  ['Prüfungen', 'Countdown und Lernplan', 'exam', 'cat-training'],
                  ['Training', 'Geplant und absolviert aus Intervals.icu', 'activity', 'cat-study'],
                ] as [string, string, IconName, string][]
              ).map(([k, v, icon, tint]) => (
                <div key={k} className={`${tint} rounded-3xl bg-cat/[0.13] p-4`}>
                  <span className="dot-cat mb-3 h-10 w-10">
                    <Icon name={icon} size={19} />
                  </span>
                  <p className="text-[15px] font-extrabold">{k}</p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-muted">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 flex items-start gap-2 text-xs text-muted">
              <Icon name="lock" size={14} className="mt-px shrink-0" />
              Deine bestehenden Google-Kalender werden nie verändert. Auf Wunsch trägt NiFlow deine eigenen Termine in einen separaten Kalender «NiFlow» ein.
              Deine Einträge sind nur für dich sichtbar.
            </p>
          </>
        )}
        <LegalLinks className="mt-6" />
      </div>
    </div>
  )
}
