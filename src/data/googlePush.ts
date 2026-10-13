import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'

export interface PushStatus {
  enabled: boolean
  hasCalendar: boolean
  lastPushAt: string | null
}

const MESSAGES: Record<string, string> = {
  reauth: 'Google-Verbindung abgelaufen. Bitte neu mit Google verbinden.',
  scope_missing: 'Google hat das Schreiben nicht erlaubt. Bitte neu mit Google verbinden und das Häkchen beim NiFlow-Kalender setzen.',
  not_enabled: 'Der Abgleich mit Google ist ausgeschaltet.',
  server_not_configured: 'Die Server-Funktion ist noch nicht eingerichtet.',
  storage_failed: 'Speichern in der Datenbank fehlgeschlagen. Ist die neue Migration eingespielt?',
}

export class PushError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

/** Ruft die Supabase-Funktion "google-push" auf. Wirft PushError mit verständlicher Meldung. */
export async function callPush<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new PushError('unauthorized', 'Nicht angemeldet.')
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/google-push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...payload }),
    })
  } catch {
    throw new PushError('network', 'Keine Verbindung zum Server.')
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || body.error) {
    const code = String(body.error ?? res.status)
    if (res.status === 404 && !body.error) throw new PushError('missing', 'Die Funktion google-push ist noch nicht hochgeladen.')
    throw new PushError(code, MESSAGES[code] ?? `Google-Abgleich fehlgeschlagen (${code}).`)
  }
  return body as T
}
