import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '../domain/types'
import { SOURCES, loadAllSources } from '../sources'
import type { SourceState } from '../sources/types'

/** Aktuelle Uhrzeit, aktualisiert sich regelmässig (für Jetzt-Linie und Countdown). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [states, setStates] = useState<SourceState[]>([])
  const [loading, setLoading] = useState(true)
  const statesRef = useRef<SourceState[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await loadAllSources(SOURCES, new Date(), statesRef.current)
    statesRef.current = result.states
    setEvents(result.events)
    setStates(result.states)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { events, states, loading, reload }
}
