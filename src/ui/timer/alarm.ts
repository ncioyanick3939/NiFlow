import { isNativeApp } from '../../lib/platform'
import type { PlannedAlert } from '../../domain/timer'

// Signale des Timers: Ton, Vibration, Mitteilung. Alles ist optional und darf still scheitern.

let ctx: AudioContext | null = null

/** Beim Tippen auf «Start» aufrufen: Browser erlauben Ton nur nach einer Berührung. */
export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // kein Ton
  }
}

/** Drei kurze, weiche Töne. */
export function playChime(): void {
  try {
    if (!ctx) return
    const t0 = ctx.currentTime + 0.02
    ;[0, 0.28, 0.56].forEach((offset, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = [784, 988, 1175][i]
      gain.gain.setValueAtTime(0.0001, t0 + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.4)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t0 + offset)
      osc.stop(t0 + offset + 0.45)
    })
  } catch {
    // kein Ton
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // keine Vibration
  }
}

const webNotificationsSupported = (): boolean => typeof Notification !== 'undefined' && !isNativeApp()

/** Mitteilung im Browser, nur wenn erlaubt und die Seite nicht im Vordergrund ist. */
export function webNotify(title: string, body: string): void {
  try {
    if (!webNotificationsSupported() || Notification.permission !== 'granted' || !document.hidden) return
    new Notification(title, { body, tag: 'niflow-timer' })
  } catch {
    // nicht unterstützt
  }
}

/** Fragt (einmal) um Erlaubnis für Mitteilungen. Beim Tippen auf «Start» aufrufen. */
export async function askNotificationPermission(): Promise<void> {
  try {
    if (isNativeApp()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const cur = await LocalNotifications.checkPermissions()
      if (cur.display === 'prompt' || cur.display === 'prompt-with-rationale') await LocalNotifications.requestPermissions()
    } else if (webNotificationsSupported() && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  } catch {
    // ohne Mitteilungen weiter
  }
}

/** Gibt es Mitteilungen, die auch bei gesperrtem Bildschirm kommen? Nur in der iOS-App. */
export const alertsWhenClosed = (): boolean => isNativeApp()

const NATIVE_IDS = [7001, 7002, 7003, 7004, 7005, 7006]

/** Plant die nächsten Signale als lokale Mitteilungen (iOS-App). Ersetzt alte. Im Browser passiert nichts. */
export async function syncNativeAlerts(plan: PlannedAlert[]): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: NATIVE_IDS.map((id) => ({ id })) })
    if (plan.length === 0) return
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return
    await LocalNotifications.schedule({
      notifications: plan.slice(0, NATIVE_IDS.length).map((a, i) => ({ id: NATIVE_IDS[i], title: a.title, body: a.body, schedule: { at: new Date(a.at), allowWhileIdle: true } })),
    })
  } catch {
    // ohne Mitteilung weiter, die App zeigt den Timer trotzdem
  }
}
