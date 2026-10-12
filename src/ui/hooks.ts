import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '../domain/types'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { SOURCES, loadAllSources } from '../sources'
import { googleSource } from '../sources/googleSource'
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

/** Anmeldestatus (Supabase). session = null: nicht verbunden. */
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

/** Verbunden: echte Google-Daten. Nicht verbunden: gekennzeichnete Testdaten. */
export function sourcesFor(connected: boolean): EventSource[] {
  return connected ? [googleSource] : SOURCES
}

export function useEvents(connected: boolean, ready: boolean) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [states, setStates] = useState<SourceState[]>([])
  const [loading, setLoading] = useState(true)
  const statesRef = useRef<SourceState[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await loadAllSources(sourcesFor(connected), new Date(), statesRef.current)
    statesRef.current = result.states
    setEvents(result.events)
    setStates(result.states)
    setLoading(false)
  }, [connected])

  useEffect(() => {
    if (ready) void reload()
  }, [reload, ready])

  return { events, states, loading, reload }
}
