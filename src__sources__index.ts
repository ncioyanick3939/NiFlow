import type { CalendarEvent } from '../domain/types'
import { testSource } from './testSource'
import type { EventSource, SourceState } from './types'

/**
 * Aktive Datenquellen. Aktuell nur Testdaten.
 * Google Kalender, Intervals.icu und Moodle werden hier später ergänzt.
 */
export const SOURCES: EventSource[] = [testSource]

export interface LoadResult {
  events: CalendarEvent[]
  states: SourceState[]
}

/**
 * Lädt alle Quellen unabhängig voneinander. Fällt eine Quelle aus, werden die anderen
 * trotzdem angezeigt und der Fehler wird pro Quelle gemeldet.
 * Doppelte Termine (gleiche ID) werden zusammengeführt.
 */
export async function loadAllSources(
  sources: EventSource[],
  now: Date,
  previous: SourceState[] = [],
): Promise<LoadResult> {
  const byId = new Map<string, CalendarEvent>()
  const states: SourceState[] = []

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return { source, events: await source.load(now), error: null as string | null }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        return { source, events: [] as CalendarEvent[], error: message }
      }
    }),
  )

  for (const { source, events, error } of results) {
    for (const e of events) byId.set(e.id, e)
    const prior = previous.find((p) => p.id === source.id)
    states.push({
      id: source.id,
      label: source.label,
      isDemo: source.isDemo,
      status: error ? 'error' : 'ok',
      lastSync: error ? (prior?.lastSync ?? null) : now,
      error: error ?? undefined,
      count: events.length,
    })
  }

  return { events: [...byId.values()], states }
}
