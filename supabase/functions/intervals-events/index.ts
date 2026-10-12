// Edge Function "intervals-events": holt geplante Trainings aus Intervals.icu.
// Der API-Schlüssel wird nur hier gespeichert (Tabelle user_secrets, für die App gesperrt) und nie zurückgegeben.
// Intervals.icu API: GET https://intervals.icu/api/v1/athlete/0/events?oldest=yyyy-MM-dd&newest=yyyy-MM-dd
// Anmeldung: HTTP Basic, Benutzername "API_KEY", Passwort = dein Schlüssel. Athlet "0" = der Besitzer des Schlüssels.
// Ohne externe Pakete (Supabase per fetch/REST).
//
// Aufruf (POST, Anmelde-Token des Nutzers):
//   { oldest, newest }                 -> { events: [...] }
//   { api_key: "..." }                 -> speichert den Schlüssel, prüft ihn und antwortet { ok: true }
//   { remove: true }                   -> löscht den Schlüssel
// Fehler: { error: "no_key" | "invalid_key" | "unauthorized" | ... }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const DATE = /^\d{4}-\d{2}-\d{2}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_not_configured' }, 500)

  const db = (path: string, init: RequestInit = {}) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

  // 1. Wer ruft auf?
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` } })
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  const user = (await userRes.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) return json({ error: 'unauthorized' }, 401)
  const userId = encodeURIComponent(user.id)

  let body: { api_key?: unknown; remove?: unknown; oldest?: unknown; newest?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // leer ist erlaubt
  }

  const intervals = (key: string, path: string) =>
    fetch(`https://intervals.icu/api/v1/${path}`, {
      headers: {
        Authorization: 'Basic ' + btoa(`API_KEY:${key}`),
        // Intervals.icu liegt hinter Cloudflare, das Clients ohne Browser-Kennung manchmal blockt.
        'User-Agent': 'Mozilla/5.0 (compatible; NiFlow)',
        Accept: 'application/json',
      },
    })

  // 2a. Schlüssel entfernen
  if (body.remove === true) {
    const del = await db(`user_secrets?user_id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ intervals_api_key: null }) })
    return del.ok ? json({ ok: true }) : json({ error: 'storage_failed' }, 500)
  }

  // 2b. Neuen Schlüssel prüfen und speichern
  if (typeof body.api_key === 'string' && body.api_key.trim().length > 0) {
    const key = body.api_key.trim()
    const today = new Date().toISOString().slice(0, 10)
    const test = await intervals(key, `athlete/0/events?oldest=${today}&newest=${today}`)
    if (test.status === 401 || test.status === 403) return json({ error: 'invalid_key' }, 400)
    if (!test.ok) return json({ error: 'intervals_error', status: test.status }, 502)
    const save = await db('user_secrets?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: user.id, intervals_api_key: key, updated_at: new Date().toISOString() }),
    })
    return save.ok ? json({ ok: true }) : json({ error: 'storage_failed', status: save.status }, 500)
  }

  // 3. Termine laden
  if (typeof body.oldest !== 'string' || typeof body.newest !== 'string' || !DATE.test(body.oldest) || !DATE.test(body.newest)) {
    return json({ error: 'bad_request' }, 400)
  }
  const load = await db(`user_secrets?select=intervals_api_key&user_id=eq.${userId}`)
  if (!load.ok) return json({ error: 'storage_failed', status: load.status }, 500)
  const rows = (await load.json().catch(() => [])) as { intervals_api_key: string | null }[]
  const key = rows[0]?.intervals_api_key
  if (!key) return json({ error: 'no_key' }, 404)

  const res = await intervals(key, `athlete/0/events?oldest=${body.oldest}&newest=${body.newest}`)
  if (res.status === 401 || res.status === 403) return json({ error: 'invalid_key' }, 401)
  if (!res.ok) return json({ error: 'intervals_error', status: res.status }, 502)
  const events = await res.json().catch(() => null)
  if (!Array.isArray(events)) return json({ error: 'intervals_error', status: 'bad_response' }, 502)
  return json({ events })
})
