// Edge Function "delete-account": löscht das Konto der anfragenden Person samt allen Daten.
// Apple verlangt (Richtlinie 5.1.1(v)), dass man ein Konto direkt in der App löschen kann.
//
// Ablauf:
// 1. Wer ruft auf? Supabase prüft den Anmelde-Token (nur die eigene Person kann sich löschen).
// 2. Google-Zugriff widerrufen (best effort, ein Fehler hier bricht das Löschen nicht ab).
// 3. Nutzer in Supabase Auth löschen. Alle Tabellen hängen mit "on delete cascade" daran
//    (Einträge, Aufgaben, Prüfungen, Kategorien, Schlüssel, Erinnerungen, KI-Zähler).
//
// Ohne externe Pakete: nur fetch. Der service_role-Schlüssel liegt nur hier als Supabase-Secret.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_not_configured' }, 500)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` } })
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  const user = (await userRes.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) return json({ error: 'unauthorized' }, 401)
  const userId = user.id

  // Ausdrückliche Bestätigung im Body verlangen, damit kein versehentlicher Aufruf löscht.
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown }
  if (body.confirm !== true) return json({ error: 'not_confirmed' }, 400)

  // 2. Google-Zugriff widerrufen (best effort)
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${encodeURIComponent(userId)}&select=refresh_token`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (r.ok) {
      const rows = (await r.json().catch(() => [])) as { refresh_token?: string }[]
      const token = rows[0]?.refresh_token
      if (token) {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        })
      }
    }
  } catch {
    // Nicht kritisch: die Person kann den Zugriff zusätzlich in ihrem Google-Konto entfernen.
  }

  // 3. Nutzer löschen, die Datenbank räumt per cascade alles Übrige auf
  const del = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  })
  if (!del.ok) return json({ error: 'delete_failed', status: del.status }, 502)
  return json({ ok: true })
})
