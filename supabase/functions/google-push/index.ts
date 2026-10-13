// Edge Function "google-push": trägt eigene NiFlow-Termine in einen EIGENEN Google-Kalender «NiFlow» ein.
// Berechtigung: https://www.googleapis.com/auth/calendar.app.created
//   ("Sekundäre Kalender erstellen und nur deren Termine sehen, erstellen, ändern und löschen").
// Andere Google-Kalender werden nie verändert. Richtung: nur NiFlow → Google.
// Doppelte Einträge werden verhindert über entries.google_event_id und die private Eigenschaft niflowId.
//
// Aktionen (POST, Anmelde-Token des Nutzers):
//   { action: 'status' }                          -> { enabled, hasCalendar, lastPushAt }
//   { action: 'enable', tz }                      -> legt Kalender an und gleicht alles ab
//   { action: 'disable', remove_calendar? }       -> schaltet aus (optional Kalender bei Google löschen)
//   { action: 'upsert', entry_id, tz }            -> einen Termin anlegen oder aktualisieren
//   { action: 'delete', google_event_id }         -> einen Termin im NiFlow-Kalender löschen
//   { action: 'sync_all', tz }                    -> alles abgleichen, verwaiste NiFlow-Termine entfernen
// Fehler: { error: 'reauth' | 'scope_missing' | 'not_enabled' | 'google_error' | ... }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const API = 'https://www.googleapis.com/calendar/v3'
const MARK = 'Von NiFlow verwaltet'

class Fail extends Error {
  constructor(public code: string, public status = 400, public detail?: unknown) {
    super(code)
  }
}

interface EntryRow {
  id: string
  type: 'event' | 'note'
  title: string
  body: string
  all_day: boolean
  start_at: string
  end_at: string | null
  recurrence: string
  recurrence_until: string | null
  exdates: string[] | null
  google_event_id: string | null
}

function validTz(tz: unknown): string {
  if (typeof tz === 'string') {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      return tz
    } catch {
      // ungültig
    }
  }
  return 'Europe/Zurich'
}

/** Datum und Uhrzeit eines Zeitpunkts in einer Zeitzone. */
function localParts(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}${p.minute}${p.second}` }
}

function rrule(rule: string, until: string | null): string | null {
  const base: Record<string, string> = {
    daily: 'FREQ=DAILY',
    weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    monthly: 'FREQ=MONTHLY',
  }
  if (!base[rule]) return null
  return until ? `RRULE:${base[rule]};UNTIL=${until.replace(/-/g, '')}T235959Z` : `RRULE:${base[rule]}`
}

function toGoogle(row: EntryRow, tz: string, padEnd = false) {
  const footer = '\n\n— Aus NiFlow. Änderungen bitte in NiFlow machen, hier werden sie überschrieben.'
  const body: Record<string, unknown> = {
    summary: row.title,
    description: (row.body || '') + footer,
    extendedProperties: { private: { niflowId: row.id } },
  }
  const startLocal = localParts(row.start_at, tz)
  if (row.all_day) {
    const endIso = row.end_at ?? new Date(new Date(row.start_at).getTime() + 86400000).toISOString()
    body.start = { date: startLocal.date }
    body.end = { date: localParts(endIso, tz).date }
  } else {
    let endIso = row.end_at ?? row.start_at
    if (padEnd && endIso === row.start_at) endIso = new Date(new Date(row.start_at).getTime() + 30 * 60000).toISOString()
    body.start = { dateTime: row.start_at, timeZone: tz }
    body.end = { dateTime: endIso, timeZone: tz }
  }
  const r = rrule(row.recurrence, row.recurrence_until)
  if (r) {
    const ex = (row.exdates ?? []).map((d) =>
      row.all_day ? `EXDATE;VALUE=DATE:${d.replace(/-/g, '')}` : `EXDATE;TZID=${tz}:${d.replace(/-/g, '')}T${startLocal.time}`,
    )
    body.recurrence = [r, ...ex]
  }
  return body
}

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
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` } })
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  const user = (await userRes.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) return json({ error: 'unauthorized' }, 401)
  const uid = encodeURIComponent(user.id)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // leer
  }
  const tz = validTz(body.tz)

  const loadSettings = async () => {
    const r = await db(`user_secrets?select=google_push_enabled,google_calendar_id,google_last_push_at&user_id=eq.${uid}`)
    if (!r.ok) throw new Fail('storage_failed', 500, r.status)
    const rows = (await r.json()) as { google_push_enabled: boolean; google_calendar_id: string | null; google_last_push_at: string | null }[]
    return rows[0] ?? { google_push_enabled: false, google_calendar_id: null, google_last_push_at: null }
  }
  const saveSettings = async (patch: Record<string, unknown>) => {
    const r = await db('user_secrets?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }),
    })
    if (!r.ok) throw new Fail('storage_failed', 500, await r.text().catch(() => r.status))
  }

  let accessToken: string | null = null
  const token = async () => {
    if (accessToken) return accessToken
    const r = await db(`google_tokens?select=refresh_token&user_id=eq.${uid}`)
    const rows = r.ok ? ((await r.json()) as { refresh_token: string }[]) : []
    if (!rows.length) throw new Fail('reauth', 401)
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: rows[0].refresh_token, grant_type: 'refresh_token' }),
    })
    const data = await t.json().catch(() => ({}))
    if (!t.ok) throw new Fail(data.error === 'invalid_grant' ? 'reauth' : 'google_error', 401, data.error)
    accessToken = data.access_token as string
    return accessToken
  }

  const gcal = async (method: string, path: string, payload?: unknown) => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    })
    if (r.status === 401) throw new Fail('reauth', 401)
    if (r.status === 403) {
      const text = await r.text().catch(() => '')
      // Fehlende Berechtigung (Nutzer hat calendar.app.created noch nicht erteilt)
      if (/insufficient|scope|PERMISSION/i.test(text)) throw new Fail('scope_missing', 403)
      throw new Fail('google_error', 502, text.slice(0, 300))
    }
    return r
  }

  const ensureCalendar = async (settings: { google_calendar_id: string | null }) => {
    if (settings.google_calendar_id) {
      const r = await gcal('GET', `/calendars/${encodeURIComponent(settings.google_calendar_id)}`)
      if (r.ok) return settings.google_calendar_id
      if (r.status !== 404 && r.status !== 410) throw new Fail('google_error', 502, r.status)
    }
    const r = await gcal('POST', '/calendars', { summary: 'NiFlow', description: `${MARK}. Termine hier legt die App an.`, timeZone: tz })
    if (!r.ok) throw new Fail('google_error', 502, await r.text().catch(() => r.status))
    const cal = (await r.json()) as { id: string }
    await saveSettings({ google_calendar_id: cal.id })
    return cal.id
  }

  const upsertRow = async (calId: string, row: EntryRow): Promise<string | null> => {
    if (row.type !== 'event') return null
    const cal = encodeURIComponent(calId)
    const send = async (method: string, path: string) => {
      let r = await gcal(method, path, toGoogle(row, tz))
      if (r.status === 400) r = await gcal(method, path, toGoogle(row, tz, true))
      return r
    }
    let eventId = row.google_event_id
    if (!eventId) {
      // Schon vorhanden (z. B. wenn das Speichern der ID zuletzt fehlschlug)? Dann wiederverwenden statt doppelt anlegen.
      const found = await gcal('GET', `/calendars/${cal}/events?privateExtendedProperty=${encodeURIComponent(`niflowId=${row.id}`)}&maxResults=5`)
      if (found.ok) {
        const items = ((await found.json()) as { items?: { id: string; status?: string }[] }).items ?? []
        eventId = items.find((i) => i.status !== 'cancelled')?.id ?? null
      }
    }
    let r: Response
    if (eventId) {
      r = await send('PUT', `/calendars/${cal}/events/${encodeURIComponent(eventId)}`)
      if (r.status === 404 || r.status === 410) r = await send('POST', `/calendars/${cal}/events`)
    } else {
      r = await send('POST', `/calendars/${cal}/events`)
    }
    if (!r.ok) throw new Fail('google_error', 502, await r.text().catch(() => r.status))
    const ev = (await r.json()) as { id: string }
    await db(`entries?id=eq.${encodeURIComponent(row.id)}&user_id=eq.${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ google_event_id: ev.id, google_synced_at: new Date().toISOString() }),
    })
    return ev.id
  }

  const COLS = 'id,type,title,body,all_day,start_at,end_at,recurrence,recurrence_until,exdates,google_event_id'

  const syncAll = async (calId: string) => {
    const r = await db(`entries?select=${COLS}&user_id=eq.${uid}&type=eq.event&limit=1000`)
    if (!r.ok) throw new Fail('storage_failed', 500, r.status)
    const rows = (await r.json()) as EntryRow[]
    let pushed = 0
    let failed = 0
    for (const row of rows) {
      try {
        await upsertRow(calId, row)
        pushed++
      } catch (err) {
        if (err instanceof Fail && (err.code === 'reauth' || err.code === 'scope_missing')) throw err
        failed++
      }
    }
    // NiFlow-Termine bei Google, deren Eintrag es in NiFlow nicht mehr gibt, entfernen.
    // Von Hand in Google angelegte Termine (ohne niflowId) bleiben unberührt.
    const ids = new Set(rows.map((x) => x.id))
    let removed = 0
    let pageToken = ''
    do {
      const list = await gcal('GET', `/calendars/${encodeURIComponent(calId)}/events?maxResults=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
      if (!list.ok) break
      const page = (await list.json()) as { items?: { id: string; extendedProperties?: { private?: { niflowId?: string } } }[]; nextPageToken?: string }
      for (const item of page.items ?? []) {
        const nid = item.extendedProperties?.private?.niflowId
        if (nid && !ids.has(nid)) {
          const d = await gcal('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(item.id)}`)
          if (d.ok || d.status === 404 || d.status === 410) removed++
        }
      }
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)
    await saveSettings({ google_last_push_at: new Date().toISOString() })
    return { pushed, failed, removed }
  }

  try {
    const action = body.action
    const settings = await loadSettings()

    if (action === 'status') {
      return json({ enabled: settings.google_push_enabled, hasCalendar: !!settings.google_calendar_id, lastPushAt: settings.google_last_push_at })
    }
    if (action === 'enable') {
      const calId = await ensureCalendar(settings)
      await saveSettings({ google_push_enabled: true })
      const result = await syncAll(calId)
      return json({ ok: true, ...result })
    }
    if (action === 'disable') {
      if (body.remove_calendar === true && settings.google_calendar_id) {
        const d = await gcal('DELETE', `/calendars/${encodeURIComponent(settings.google_calendar_id)}`)
        if (!d.ok && d.status !== 404 && d.status !== 410) throw new Fail('google_error', 502, d.status)
        await db(`entries?user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ google_event_id: null, google_synced_at: null }) })
        await saveSettings({ google_push_enabled: false, google_calendar_id: null })
      } else {
        await saveSettings({ google_push_enabled: false })
      }
      return json({ ok: true })
    }

    if (!settings.google_push_enabled) return json({ error: 'not_enabled' }, 409)
    const calId = await ensureCalendar(settings)

    if (action === 'upsert' && typeof body.entry_id === 'string') {
      const r = await db(`entries?select=${COLS}&id=eq.${encodeURIComponent(body.entry_id)}&user_id=eq.${uid}`)
      const rows = r.ok ? ((await r.json()) as EntryRow[]) : []
      if (!rows.length) return json({ error: 'not_found' }, 404)
      const id = await upsertRow(calId, rows[0])
      return json({ ok: true, google_event_id: id })
    }
    if (action === 'delete' && typeof body.google_event_id === 'string') {
      const d = await gcal('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(body.google_event_id)}`)
      if (!d.ok && d.status !== 404 && d.status !== 410) throw new Fail('google_error', 502, d.status)
      return json({ ok: true })
    }
    if (action === 'sync_all') {
      return json({ ok: true, ...(await syncAll(calId)) })
    }
    return json({ error: 'bad_request' }, 400)
  } catch (err) {
    if (err instanceof Fail) {
      if (err.code === 'google_error' || err.code === 'storage_failed') console.error(err.code, err.detail)
      return json({ error: err.code, detail: err.detail ?? null }, err.status)
    }
    console.error('unexpected', err)
    return json({ error: 'unexpected' }, 500)
  }
})
