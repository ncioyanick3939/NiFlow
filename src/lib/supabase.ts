import { isNativeApp, PUBLIC_APP_URL } from './platform'
import { createClient } from '@supabase/supabase-js'

// Diese beiden Werte sind öffentlich gedacht (Project URL und "Publishable key").
// Der Datenschutz kommt von den Zugriffsregeln (RLS) in der Datenbank, nicht vom Verstecken.
// Geheime Schlüssel (secret / service_role) gehören NIE in diesen Code.
export const SUPABASE_URL = 'https://rfhgqswrwceutvmeolfk.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QoI1ZxdSntM97EfWFvcrNA_2jC-1qZX'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// Lesen aller Kalender + eigenen Kalender «NiFlow» anlegen und nur dessen Termine verwalten.
export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.app.created'

/** Startet die Google-Anmeldung (nur Lesezugriff auf den Kalender). */
export async function connectGoogle(): Promise<void> {
  const redirectTo = window.location.origin + window.location.pathname
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw error
}

export async function disconnectGoogle(): Promise<void> {
  await supabase.auth.signOut()
}

/** Wo die Links aus E-Mails (Bestätigen, Passwort zurücksetzen) wieder in die App führen. */
const appUrl = () => (isNativeApp() ? PUBLIC_APP_URL : window.location.origin + window.location.pathname)

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

/** Legt ein Konto an. Gibt true zurück, wenn noch die E-Mail bestätigt werden muss. */
export async function signUpWithEmail(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl() } })
  if (error) throw error
  return !data.session
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
  if (error) throw error
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Hat dieses Konto eine Google-Anmeldung (und damit eine Google-Kalender-Verbindung)? */
export function hasGoogleIdentity(session: { user: { identities?: { provider: string }[]; app_metadata?: { providers?: string[]; provider?: string } } } | null): boolean {
  const u = session?.user
  if (!u) return false
  return !!u.identities?.some((i) => i.provider === 'google') || !!u.app_metadata?.providers?.includes('google') || u.app_metadata?.provider === 'google'
}

/** Löscht das Konto samt allen Daten (Server-Funktion "delete-account") und meldet ab. */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Nicht angemeldet.')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || !body.ok) {
    throw new Error(
      res.status === 404
        ? 'Die Lösch-Funktion ist auf dem Server noch nicht eingerichtet.'
        : `Das Konto konnte nicht gelöscht werden (${body.error ?? res.status}). Bitte versuche es später noch einmal.`,
    )
  }
  await supabase.auth.signOut({ scope: 'local' })
}
