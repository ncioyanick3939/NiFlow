import { addDays, startOfWeek } from '../domain/dateUtils'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'
import { mapIntervalsEvent } from './intervals'
import type { IntervalsEventItem } from './intervals'
import type { EventSource } from './types'

/** Wird geworfen, wenn noch kein Schlüssel hinterlegt ist. Die Quelle wird dann nicht angezeigt. */
export class NotConfigured extends Error {
  name = 'NotConfigured'
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Ruft die Supabase-Funktion "intervals-events" auf (Anmeldung nötig). */
export async function callIntervals(payload: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Nicht angemeldet.')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/intervals-events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

export const intervalsSource: EventSource = {
  id: 'intervals',
  label: 'Intervals.icu',
  isDemo: false,
  load: async (now) => {
    const monday = startOfWeek(now)
    const { status, body } = await callIntervals({
      oldest: ymd(addDays(monday, -14)),
      newest: ymd(addDays(monday, 8 * 7)),
    })
    if (body.error === 'no_key') throw new NotConfigured()
    if (body.error === 'invalid_key') throw new Error('Intervals.icu-Schlüssel ungültig. Bitte in den Einstellungen neu eintragen.')
    if (status !== 200 || !Array.isArray(body.events)) {
      throw new Error(`Server-Funktion nicht erreichbar (${String(body.error ?? status)}).`)
    }
    return (body.events as IntervalsEventItem[]).flatMap((item) => {
      const e = mapIntervalsEvent(item)
      return e ? [e] : []
    })
  },
}
