import { addDays, startOfWeek } from '../domain/dateUtils'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, hasGoogleIdentity, supabase } from '../lib/supabase'
import { NotConfigured } from './intervalsSource'
import { fetchGoogleEvents } from './googleCalendar'
import type { EventSource } from './types'

const REAUTH = 'Google-Verbindung abgelaufen. Bitte neu verbinden.'

/**
 * Holt über die Supabase-Funktion "google-token" einen frischen Google-Zugriffsschlüssel.
 * Direkt nach der Google-Anmeldung wird dabei das Refresh-Token einmalig an den Server übergeben
 * und dort gespeichert. Danach bleibt die Verbindung bestehen, ohne dass man sich neu anmeldet.
 */
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) throw new Error('Nicht verbunden. Bitte mit Google verbinden.')
  // Konto ohne Google-Anmeldung (E-Mail): Google ist einfach nicht eingerichtet, kein Fehler.
  if (!hasGoogleIdentity(session)) throw new NotConfigured()

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(session.provider_refresh_token ? { refresh_token: session.provider_refresh_token } : {}),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (res.ok && body.access_token) return body.access_token

  if (body.error === 'reauth' || res.status === 401) {
    // Falls die Funktion noch nicht eingerichtet ist, hilft der kurzlebige Schlüssel der Anmeldung.
    if (session.provider_token) return session.provider_token
    throw new Error(REAUTH)
  }
  if (session.provider_token) return session.provider_token
  throw new Error(`Server-Funktion nicht erreichbar (${body.error ?? res.status}).`)
}

/** Google Kalender (echte Daten, nur lesend). */
export const googleSource: EventSource = {
  id: 'google',
  label: 'Google Kalender',
  isDemo: false,
  load: async (now) => {
    const token = await getAccessToken()
    const from = addDays(startOfWeek(now), -14)
    const to = addDays(startOfWeek(now), 8 * 7)
    return fetchGoogleEvents(token, from, to)
  },
}
