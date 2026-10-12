// Gemeinsame Datentypen. Alle Datenquellen werden in dieses eine Format übersetzt,
// damit "Heute" und "Woche" immer exakt dieselben Daten verwenden.

export type Category = 'training' | 'work' | 'study' | 'private'
export type SourceId = 'test' | 'google' | 'intervals' | 'moodle'
export type EventKind = 'event' | 'deadline' | 'exam'
export type Intensity = 'low' | 'medium' | 'high'

export interface CalendarEvent {
  /** Eindeutig pro Quelle + externe ID. Verhindert Duplikate bei erneuter Synchronisation. */
  id: string
  source: SourceId
  externalId: string
  title: string
  start: Date
  /** null = Ende unbekannt (z. B. Moodle-Frist). Wird NICHT als freie Zeit behandelt. */
  end: Date | null
  /** Ganztägig: start = Mitternacht des ersten Tags, end = Mitternacht nach dem letzten Tag. */
  allDay: boolean
  category: Category
  kind: EventKind
  intensity?: Intensity
  description?: string
}

export const CATEGORY_LABEL: Record<Category, string> = {
  training: 'Training',
  work: 'Arbeit',
  study: 'Studium',
  private: 'Privat',
}

export const SOURCE_LABEL: Record<SourceId, string> = {
  test: 'Testdaten',
  google: 'Google Kalender',
  intervals: 'Intervals.icu',
  moodle: 'Moodle',
}

export function makeEventId(source: SourceId, externalId: string): string {
  return `${source}:${externalId}`
}
