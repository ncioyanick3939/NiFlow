import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'
import type { Reminder } from '../domain/reminders'

// Erinnerungen bei geschlossener App: Gerät anmelden (Edge Function "push") und
// anstehende Erinnerungen in die Warteschlange legen (Datenbank-Funktion replace_push_queue).

const MESSAGES: Record<string, string> = {
  not_configured: 'Auf dem Server fehlen noch die Push-Schlüssel (VAPID). Siehe Einrichtung.',
  invalid_subscription: 'Dieses Gerät hat eine ungültige Push-Adresse geliefert.',
  no_device: 'Auf diesem Konto ist noch kein Gerät eingeschaltet.',
  storage_failed: 'Speichern fehlgeschlagen. Ist die neue Migration eingespielt?',
  unauthorized: 'Nicht angemeldet.',
}

export class WebPushError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const headers: Record<string, string> = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/push`, { method: 'POST', headers, body: JSON.stringify(payload) })
  } catch {
    throw new WebPushError('network', 'Keine Verbindung zum Server.')
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 404 && !body.error) throw new WebPushError('missing', 'Die Funktion «push» ist noch nicht hochgeladen.')
  if (!res.ok || body.error) {
    const code = String(body.error ?? res.status)
    throw new WebPushError(code, MESSAGES[code] ?? `Fehler (${code}).`)
  }
  return body as T
}

/** Kann dieser Browser Web Push? */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

/** iPhone/iPad: Web Push nur, wenn NiFlow vom Home-Bildschirm aus geöffnet ist. */
export function needsHomeScreen(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) return reg
  return navigator.serviceWorker.register('./sw.js')
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

const toBytes = (b64: string) => {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Auf diesem Gerät einschalten. Muss direkt aus einem Klick kommen (Berechtigungsabfrage). */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new WebPushError('unsupported', 'Dieser Browser unterstützt keine Push-Benachrichtigungen.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new WebPushError('denied', 'Benachrichtigungen wurden nicht erlaubt. Du kannst das in den Einstellungen des Geräts ändern.')
  const { publicKey } = await call<{ publicKey: string }>({ action: 'key' })
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  // Abo mit altem Schlüssel ersetzen
  if (sub && sub.options.applicationServerKey) {
    const old = new Uint8Array(sub.options.applicationServerKey)
    const now = toBytes(publicKey)
    if (old.length !== now.length || old.some((b, i) => b !== now[i])) {
      await sub.unsubscribe()
      sub = null
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) })
  await call({ action: 'subscribe', subscription: sub.toJSON(), userAgent: navigator.userAgent })
  markLocal(true)
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (sub) {
    await call({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
  }
  markLocal(false)
}

export async function testPush(): Promise<{ sent: number; failed: number }> {
  const sub = await currentSubscription()
  return call({ action: 'test', ...(sub ? { endpoint: sub.endpoint } : {}) })
}

export async function pushStatus(): Promise<{ configured: boolean; devices: number }> {
  return call({ action: 'status' })
}

// Merker im Browser: Dieses Gerät bekommt Push. Dann zeigt die offene App keine zweite Systemmeldung.
const LOCAL = 'niflow-push-on'
function markLocal(on: boolean) {
  try {
    if (on) localStorage.setItem(LOCAL, '1')
    else localStorage.removeItem(LOCAL)
  } catch {
    // ignorieren
  }
}
export function pushOnThisDevice(): boolean {
  try {
    return localStorage.getItem(LOCAL) === '1'
  } catch {
    return false
  }
}

/** Anstehende Erinnerungen ersetzen. Gibt false zurück, wenn die Datenbank-Funktion (noch) fehlt. */
export async function syncQueue(items: Reminder[]): Promise<boolean> {
  const { error } = await supabase.rpc('replace_push_queue', {
    items: items.map((r) => ({ key: r.key.slice(0, 300), fire_at: r.at.toISOString(), title: r.title.slice(0, 200), body: r.body.slice(0, 300) })),
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST205') return false
    throw new Error(error.message)
  }
  return true
}
