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
