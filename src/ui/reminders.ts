import { useEffect, useRef, useState } from 'react'
import { remindersBetween } from '../domain/reminders'
import type { Reminder } from '../domain/reminders'
import type { Task } from '../domain/tasks'
import type { CalendarEvent } from '../domain/types'
import { pushOnThisDevice, syncQueue } from '../data/webPush'

const FIRED_KEY = 'niflow-reminders-fired'

function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveFired(set: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-300)))
  } catch {
    // ignorieren
  }
}

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as NotifyState
}

/**
 * Prüft alle 30 Sekunden, ob eine Erinnerung fällig ist. Funktioniert nur, solange NiFlow
 * in einem Browser-Tab geöffnet ist. Beim Öffnen werden verpasste Erinnerungen der letzten
 * 15 Minuten noch gezeigt. Jede Erinnerung erscheint nur einmal (pro Browser).
 */
export function useReminders(events: CalendarEvent[], tasks: Task[], active: boolean, onFire: (r: Reminder) => void) {
  const last = useRef(new Date(Date.now() - 15 * 60000))
  const latest = useRef({ events, tasks, onFire })
  latest.current = { events, tasks, onFire }

  useEffect(() => {
    if (!active) return
    const check = () => {
      const now = new Date()
      const due = remindersBetween(latest.current.events, latest.current.tasks, last.current, now)
      last.current = now
      if (due.length === 0) return
      const fired = loadFired()
      for (const r of due) {
        if (fired.has(r.key)) continue
        fired.add(r.key)
        // Bekommt dieses Gerät die Erinnerung schon per Push, keine zweite Systemmeldung
        if (notifyState() === 'granted' && !pushOnThisDevice()) {
          try {
            new Notification(r.title, { body: r.body, tag: r.key })
          } catch {
            // manche Handys erlauben Benachrichtigungen nur über einen Service Worker
          }
        }
        latest.current.onFire(r)
      }
      saveFired(fired)
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [active])
}

export function useNotifyPermission() {
  const [state, setState] = useState<NotifyState>(notifyState)
  const request = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setState(result as NotifyState)
  }
  return { state, request }
}

const QUEUE_HASH = 'niflow-push-queue'
const QUEUE_DAYS = 14

/**
 * Legt die Erinnerungen der nächsten zwei Wochen auf den Server, damit sie auch bei
 * geschlossener App kommen. Nur wenn sich etwas geändert hat (pro Browser gemerkt).
 */
export function usePushQueue(events: CalendarEvent[], tasks: Task[], active: boolean) {
  const disabled = useRef(false)
  useEffect(() => {
    if (!active || disabled.current) return
    const id = setTimeout(() => {
      const now = new Date()
      const items = remindersBetween(events, tasks, new Date(now.getTime() - 60000), new Date(now.getTime() + QUEUE_DAYS * 86400000)).slice(0, 300)
      const hash = JSON.stringify(items.map((r) => [r.key, r.at.getTime(), r.title, r.body]))
      let prev: string | null = null
      try {
        prev = localStorage.getItem(QUEUE_HASH)
      } catch {
        // ignorieren
      }
      // Einmal am Tag trotzdem neu schicken, damit das 14-Tage-Fenster weiterrückt
      const day = now.toDateString()
      if (prev === `${day}|${hash}`) return
      syncQueue(items)
        .then((ok) => {
          if (!ok) {
            disabled.current = true // Migration fehlt noch: nicht weiter versuchen
            return
          }
          try {
            localStorage.setItem(QUEUE_HASH, `${day}|${hash}`)
          } catch {
            // ignorieren
          }
        })
        .catch(() => {
          // Netzwerkfehler: beim nächsten Mal wieder
        })
    }, 3000)
    return () => clearTimeout(id)
  }, [events, tasks, active])
}
