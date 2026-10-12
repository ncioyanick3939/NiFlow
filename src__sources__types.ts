import type { CalendarEvent, SourceId } from '../domain/types'

/** Jede Datenquelle (Google, Intervals.icu, Moodle, Testdaten) implementiert dieses Interface. */
export interface EventSource {
  id: SourceId
  label: string
  /** true = erfundene Beispieldaten, keine echte Synchronisation. */
  isDemo: boolean
  load: (now: Date) => Promise<CalendarEvent[]>
}

export interface SourceState {
  id: SourceId
  label: string
  isDemo: boolean
  status: 'ok' | 'error'
  /** Zeitpunkt der letzten erfolgreichen Ladung. */
  lastSync: Date | null
  error?: string
  count: number
}
