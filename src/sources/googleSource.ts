import { addDays, startOfWeek } from '../domain/dateUtils'
import { supabase } from '../lib/supabase'
import { fetchGoogleEvents } from './googleCalendar'
import type { EventSource } from './types'

/**
 * Google Kalender (echte Daten, nur lesend).
 * Schritt 1: Der Zugriff gilt nur solange die Anmeldung frisch ist (ca. 1 Stunde),
 * danach muss man neu verbinden. Dauerhafte Synchronisierung kommt mit der Server-Funktion.
 */
export const googleSource: EventSource = {
  id: 'google',
  label: 'Google Kalender',
  isDemo: false,
  load: async (now) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.provider_token
    if (!token) throw new Error('Nicht verbunden oder Verbindung abgelaufen. Bitte neu verbinden.')
    const from = addDays(startOfWeek(now), -14)
    const to = addDays(startOfWeek(now), 8 * 7)
    return fetchGoogleEvents(token, from, to)
  },
}
