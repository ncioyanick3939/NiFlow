import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CalendarEvent, SourceId } from '../domain/types'
import { supabase } from '../lib/supabase'
import { loadAllSources } from '../sources'
import { googleSource } from '../sources/googleSource'
import { intervalsSource } from '../sources/intervalsSource'
import { ownSource } from '../sources/ownSource'
import { testSource } from '../sources/testSource'
import type { EventSource, SourceState } from '../sources/types'

/** Aktuelle Uhrzeit, aktualisiert sich regelmässig (für Jetzt-Linie und Countdown). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

/** Anmeldestatus (Supabase). session = null: nicht angemeldet. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, ready, connected: !!session }
}

export type DataMode = 'live' | 'demo' | 'off'

/** Angemeldet: eigene Einträge + Google + Intervals. Demo: gekennzeichnete Testdaten. */
export function sourcesFor(mode: DataMode): EventSource[] {
  if (mode === 'live') return [ownSource, googleSource, intervalsSource]
  if (mode === 'demo') return [testSource]
  return []
}

/**
 * Lädt alle Quellen. reload(['own']) lädt gezielt nur einzelne Quellen neu (z. B. nach dem
 * Speichern eines eigenen Eintrags) und behält die übrigen Daten.
 */
export function useEvents(mode: DataMode, ready: boolean) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [states, setStates] = useState<SourceState[]>([])
  const [loading, setLoading] = useState(true)
  const bySource = useRef(new Map<SourceId, CalendarEvent[]>())
  const statesRef = useRef<SourceState[]>([])

  const reload = useCallback(
    async (only?: SourceId[]) => {
      const all = sourcesFor(mode)
      const sources = only ? all.filter((s) => only.includes(s.id)) : all
      if (!only) {
        bySource.current = new Map()
        statesRef.current = []
      }
      setLoading(true)
      const result = await loadAllSources(sources, new Date(), statesRef.current)
      for (const s of sources) bySource.current.set(s.id, result.events.filter((e) => e.source === s.id))
      const ids = new Set(sources.map((s) => s.id))
      statesRef.current = [...statesRef.current.filter((s) => !ids.has(s.id)), ...result.states].sort(
        (a, b) => all.findIndex((s) => s.id === a.id) - all.findIndex((s) => s.id === b.id),
      )
      setEvents([...bySource.current.values()].flat())
      setStates(statesRef.current)
      setLoading(false)
    },
    [mode],
  )

  useEffect(() => {
    if (ready) void reload()
  }, [reload, ready])

  return { events, states, loading, reload }
}

const VIEW_KEY = 'niflow-calendar-view'

/** Kleine Komfort-Einstellung pro Browser (z. B. zuletzt gewählte Kalenderansicht). */
export function useStoredState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key)
      if (v && (allowed as readonly string[]).includes(v)) return v as T
    } catch {
      // ignorieren
    }
    return initial
  })
  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        // ignorieren
      }
    },
    [key],
  )
  return [value, set] as const
}

export { VIEW_KEY }
