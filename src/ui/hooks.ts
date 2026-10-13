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
import { listExams, listTasks } from '../data/planner'
import { createDemoPlanner } from '../data/demoPlanner'
import type { Exam } from '../domain/exams'
import type { Task } from '../domain/tasks'

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

/** Aufgaben und Prüfungen (eigene Daten). Im Demo-Modus erfundene Beispiele. */
export function usePlanner(mode: DataMode, ready: boolean) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (mode === 'off') {
      setTasks([])
      setExams([])
      setLoading(false)
      return
    }
    if (mode === 'demo') {
      const demo = createDemoPlanner(new Date())
      setTasks(demo.tasks)
      setExams(demo.exams)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [t, x] = await Promise.all([listTasks(), listExams()])
      setTasks(t)
      setExams(x)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgaben und Prüfungen konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    if (ready) void reload()
  }, [reload, ready])

  /** Sofort in der Oberfläche ändern (z. B. Abhaken), bevor die Datenbank antwortet. */
  const patchTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  return { tasks, exams, loading, error, reload, patchTask }
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

export type DashSection = 'free' | 'tasks' | 'exams' | 'days' | 'plan' | 'training' | 'quick'
export const DASH_LABEL: Record<DashSection, string> = {
  free: 'Freie Zeit zwischen Terminen',
  tasks: 'Aufgaben für heute',
  exams: 'Anstehende Prüfungen',
  days: 'Nächste Tage',
  plan: 'Diese Woche geplant',
  training: 'Training',
  quick: 'Schnell festhalten',
}
const DASH_KEY = 'niflow-dashboard'
const DASH_DEFAULT: Record<DashSection, boolean> = { free: true, tasks: true, exams: true, days: true, plan: true, training: true, quick: true }

/** Welche Bereiche die Übersicht zeigt. Wird pro Browser gespeichert. */
export function useDashboardPrefs() {
  const [prefs, setPrefs] = useState<Record<DashSection, boolean>>(() => {
    try {
      return { ...DASH_DEFAULT, ...(JSON.parse(localStorage.getItem(DASH_KEY) ?? '{}') as Partial<Record<DashSection, boolean>>) }
    } catch {
      return DASH_DEFAULT
    }
  })
  const toggle = useCallback((k: DashSection) => {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] }
      try {
        localStorage.setItem(DASH_KEY, JSON.stringify(next))
      } catch {
        // ignorieren
      }
      return next
    })
  }, [])
  return { prefs, toggle }
}
