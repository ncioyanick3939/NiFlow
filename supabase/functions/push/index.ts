// Edge Function "push": Erinnerungen als Web Push, auch wenn NiFlow geschlossen ist.
// Ohne externe Pakete: Verschlüsselung (RFC 8291, aes128gcm) und VAPID (RFC 8292) mit Web Crypto.
//
// Geheimnisse (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   öffentlicher Schlüssel (base64url, 65 Bytes)
//   VAPID_PRIVATE_KEY  privater Schlüssel (base64url, 32 Bytes)
//   VAPID_SUBJECT      mailto:deine@adresse
//
// Aktionen (POST JSON):
//   { action: "key" }                               -> { publicKey }            (ohne Anmeldung)
//   { action: "status" }                            -> { configured, devices }
//   { action: "subscribe", subscription, userAgent } -> { ok }
//   { action: "unsubscribe", endpoint }             -> { ok }
//   { action: "test", endpoint? }                   -> { sent, failed }
//   { action: "send" }                              -> { sent, failed }        (jede Minute vom Zeitplan)

// ---------- Hilfen ----------

const enc = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(text: string): Uint8Array {
  const s = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64urlDecodeSafe(text: string): Uint8Array | null {
  try {
    return b64urlDecode(text)
  } catch {
    return null
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

// ---------- Verschlüsselung (RFC 8291) ----------

/**
 * Verschlüsselt eine Nachricht für ein Abo (p256dh und auth aus der Subscription des Browsers).
 * Ergebnis ist der fertige Request-Body mit Header (Salt, Record-Grösse, Absender-Schlüssel).
 */
export async function encryptPayload(payload: Uint8Array, p256dhB64: string, authB64: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dhB64)
  const authSecret = b64urlDecode(authB64)
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('invalid_subscription_keys')

  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // Ein einziger Datensatz: Inhalt + Trennzeichen 0x02
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

// ---------- VAPID (RFC 8292) ----------

export async function vapidHeader(endpoint: string, publicB64: string, privateB64: string, subject: string, now = Date.now()): Promise<string> {
  const pub = b64urlDecode(publicB64)
  const d = b64urlDecode(privateB64)
  if (pub.length !== 65 || d.length !== 32) throw new Error('invalid_vapid_keys')
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: b64urlEncode(d), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)))
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${publicB64}`
}

/** Nur bekannte Push-Dienste (Apple, Google, Mozilla, Microsoft). */
export function allowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    if (u.protocol !== 'https:') return false
    return /(^|\.)push\.apple\.com$|^fcm\.googleapis\.com$|^android\.googleapis\.com$|(^|\.)push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$/.test(u.hostname)
  } catch {
    return false
  }
}

interface Sub {
  endpoint: string
  p256dh: string
  auth: string
  user_id?: string
}

/**
 * Geheimnisse tolerant lesen: mitkopierter Name ("VAPID_PRIVATE_KEY=…"), Anführungszeichen,
 * Leerzeichen und Zeilenumbrüche werden entfernt, Standard-Base64 wird zu base64url.
 */
export function cleanSecret(raw: string | undefined, name: string): string {
  let v = (raw ?? '').trim()
  if (v.toUpperCase().startsWith(name.toUpperCase() + '=')) v = v.slice(name.length + 1)
  v = v.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '')
  return v.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type PushResult = { result: 'ok' | 'gone' | 'error'; reason: string }

/** Schickt eine Nachricht. Ergebnis mit Grund (für die Anzeige in der App). */
async function sendPush(sub: Sub, message: unknown, vapid: { pub: string; priv: string; subject: string }, ttl = 3600): Promise<PushResult> {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth)
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(sub.endpoint, vapid.pub, vapid.priv, vapid.subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: 'high',
      },
      body,
    })
    if (res.status === 404 || res.status === 410) return { result: 'gone', reason: 'gone' }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200)
      console.error('push failed', res.status, text)
      const m = /(BadJwtToken|VapidPkHashMismatch|BadWebPushTopic|ExpiredProviderToken|BadAuthorizationHeader|TooManyRequests|PayloadTooLarge)/.exec(text)
      return { result: 'error', reason: m ? m[1] : `status_${res.status}` }
    }
    return { result: 'ok', reason: 'ok' }
  } catch (err) {
    console.error('push error', String(err))
    const msg = String(err)
    return { result: 'error', reason: msg.includes('invalid_vapid_keys') ? 'invalid_vapid_keys' : msg.includes('invalid_subscription_keys') ? 'invalid_subscription_keys' : 'send_failed' }
  }
}

// ---------- Server ----------

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const env = (k: string) => (globalThis as unknown as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env.get(k)
  const supabaseUrl = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_not_configured' }, 500)
  const vapid = {
    pub: cleanSecret(env('VAPID_PUBLIC_KEY'), 'VAPID_PUBLIC_KEY'),
    priv: cleanSecret(env('VAPID_PRIVATE_KEY'), 'VAPID_PRIVATE_KEY'),
    subject: (env('VAPID_SUBJECT') ?? '').trim().replace(/^VAPID_SUBJECT=/i, '').replace(/^["'`]+|["'`]+$/g, '').replace(/^mailto:\s+/i, 'mailto:'),
  }
  const configured = !!(vapid.pub && vapid.priv && vapid.subject.startsWith('mailto:'))

  const db = (path: string, init: RequestInit = {}) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // leer
  }
  const action = String(body.action ?? '')

  if (action === 'key') return configured ? json({ publicKey: vapid.pub }) : json({ error: 'not_configured' }, 503)

  // ----- Zeitplan: fällige Erinnerungen verschicken -----
  if (action === 'send') {
    if (!configured) return json({ error: 'not_configured' }, 503)
    const now = new Date()
    const oldest = new Date(now.getTime() - 30 * 60000)
    // Fällige Zeilen in einem Schritt "beanspruchen": parallel laufende Aufrufe bekommen sie nicht nochmals
    const claim = await db(
      `push_queue?sent_at=is.null&fire_at=lte.${encodeURIComponent(now.toISOString())}&fire_at=gte.${encodeURIComponent(oldest.toISOString())}&select=user_id,key,title,body,fire_at`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ sent_at: now.toISOString() }) },
    )
    if (!claim.ok) {
      console.error('claim failed', claim.status, (await claim.text()).slice(0, 200))
      return json({ error: 'storage_failed' }, 500)
    }
    const due = (await claim.json()) as { user_id: string; key: string; title: string; body: string }[]
    // Zu alte, nie verschickte Erinnerungen ebenfalls abhaken (nicht nachträglich schicken)
    await db(`push_queue?sent_at=is.null&fire_at=lt.${encodeURIComponent(oldest.toISOString())}`, { method: 'PATCH', body: JSON.stringify({ sent_at: now.toISOString() }) })
    if (due.length === 0) return json({ sent: 0, failed: 0 })

    const users = [...new Set(due.map((d) => d.user_id))]
    const subsRes = await db(`push_subscriptions?user_id=in.(${users.join(',')})&select=user_id,endpoint,p256dh,auth`)
    const subs = subsRes.ok ? ((await subsRes.json()) as Sub[]) : []
    let sent = 0
    let failed = 0
    const gone = new Set<string>()
    const okEndpoints = new Set<string>()
    for (const d of due) {
      for (const s of subs.filter((x) => x.user_id === d.user_id && !gone.has(x.endpoint))) {
        const r = (await sendPush(s, { title: d.title, body: d.body, tag: d.key }, vapid)).result
        if (r === 'ok') {
          sent++
          okEndpoints.add(s.endpoint)
        } else {
          failed++
          if (r === 'gone') gone.add(s.endpoint)
        }
      }
    }
    for (const e of gone) await db(`push_subscriptions?endpoint=eq.${encodeURIComponent(e)}`, { method: 'DELETE' })
    for (const e of okEndpoints) await db(`push_subscriptions?endpoint=eq.${encodeURIComponent(e)}`, { method: 'PATCH', body: JSON.stringify({ last_ok_at: now.toISOString() }) })
    return json({ sent, failed })
  }

  // ----- Ab hier nur angemeldet -----
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` } })
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  const user = (await userRes.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) return json({ error: 'unauthorized' }, 401)
  const uid = encodeURIComponent(user.id)

  if (action === 'status') {
    const r = await db(`push_subscriptions?user_id=eq.${uid}&select=endpoint`)
    if (!r.ok) return json({ error: 'storage_failed' }, 500)
    const list = (await r.json()) as { endpoint: string }[]
    const keysValid = b64urlDecodeSafe(vapid.pub)?.length === 65 && b64urlDecodeSafe(vapid.priv)?.length === 32
    return json({ configured, keysValid, devices: list.length, endpoints: list.map((x) => x.endpoint) })
  }

  if (action === 'subscribe') {
    const s = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
    const endpoint = typeof s?.endpoint === 'string' ? s.endpoint : ''
    const p256dh = typeof s?.keys?.p256dh === 'string' ? s.keys.p256dh : ''
    const auth = typeof s?.keys?.auth === 'string' ? s.keys.auth : ''
    if (!allowedEndpoint(endpoint) || endpoint.length > 1000 || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,40}$/.test(auth)) {
      return json({ error: 'invalid_subscription' }, 400)
    }
    const r = await db('push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: user.id, endpoint, p256dh, auth, user_agent: String(body.userAgent ?? '').slice(0, 300) }),
    })
    if (!r.ok) {
      console.error('subscribe failed', r.status, (await r.text()).slice(0, 200))
      return json({ error: 'storage_failed' }, 500)
    }
    return json({ ok: true })
  }

  if (action === 'unsubscribe') {
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
    const r = await db(`push_subscriptions?user_id=eq.${uid}&endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
    return r.ok ? json({ ok: true }) : json({ error: 'storage_failed' }, 500)
  }

  if (action === 'test') {
    if (!configured) return json({ error: 'not_configured' }, 503)
    const filter = typeof body.endpoint === 'string' ? `&endpoint=eq.${encodeURIComponent(body.endpoint)}` : ''
    const r = await db(`push_subscriptions?user_id=eq.${uid}${filter}&select=endpoint,p256dh,auth`)
    const subs = r.ok ? ((await r.json()) as Sub[]) : []
    if (subs.length === 0) return json({ error: 'no_device' }, 404)
    let sent = 0
    let failed = 0
    const reasons: string[] = []
    for (const s of subs) {
      const res = await sendPush(s, { title: 'NiFlow', body: 'So sehen deine Erinnerungen aus.', tag: 'niflow-test' }, vapid, 300)
      if (res.result === 'ok') sent++
      else {
        failed++
        reasons.push(res.reason)
        if (res.result === 'gone') await db(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' })
      }
    }
    return json({ sent, failed, reasons })
  }

  return json({ error: 'unknown_action' }, 400)
}

// In Supabase (Deno) als Server starten; in Tests nur die Funktionen oben verwenden.
const deno = (globalThis as unknown as { Deno?: { serve(h: (r: Request) => Promise<Response>): void } }).Deno
if (deno) deno.serve(handle)
