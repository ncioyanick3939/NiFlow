// Edge Function "google-token": hält den Google-Zugang dauerhaft offen.
// - Speichert das Google-Refresh-Token des angemeldeten Nutzers (Tabelle google_tokens, nur für den Server lesbar).
// - Tauscht es bei jedem Aufruf gegen einen frischen Zugriffsschlüssel (ca. 1 Stunde gültig).
// Das Google Client Secret liegt nur hier als Supabase-Secret, nie in der App.
// Ohne externe Pakete: Supabase wird direkt per fetch angesprochen (REST), damit das Hochladen
// auch ohne Zugriff auf npm funktioniert.

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

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) return json({ error: 'server_not_configured' }, 500)

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

  // 1. Wer ruft auf? Supabase prüft den Anmelde-Token des Nutzers.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` },
  })
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  const user = (await userRes.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) return json({ error: 'unauthorized' }, 401)
  const userId = user.id

  // 2. Neues Refresh-Token speichern (kommt nur direkt nach der Google-Anmeldung).
  let body: { refresh_token?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // leerer Body ist erlaubt
  }
  if (typeof body.refresh_token === 'string' && body.refresh_token.length > 0) {
    const save = await db('google_tokens?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, refresh_token: body.refresh_token, updated_at: new Date().toISOString() }),
    })
    if (!save.ok) {
      console.error('storage_failed beim Speichern', save.status, await save.text().catch(() => ''))
      return json({ error: 'storage_failed', status: save.status }, 500)
    }
  }

  // 3. Gespeichertes Token laden.
  const load = await db(`google_tokens?select=refresh_token&user_id=eq.${encodeURIComponent(userId)}`)
  if (!load.ok) return json({ error: 'storage_failed', status: load.status }, 500)
  const rows = (await load.json().catch(() => [])) as { refresh_token: string }[]
  if (!rows.length) return json({ error: 'reauth' }, 401)

  // 4. Bei Google gegen einen frischen Zugriffsschlüssel tauschen.
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rows[0].refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const token = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (token.error === 'invalid_grant') {
      // Zugang von Google widerrufen oder abgelaufen (im Testmodus nach 7 Tagen).
      await db(`google_tokens?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' })
      return json({ error: 'reauth' }, 401)
    }
    return json({ error: 'google_error', detail: token.error ?? res.status }, 502)
  }
  return json({ access_token: token.access_token, expires_in: token.expires_in })
})
