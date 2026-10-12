import { addDays, startOfWeek } from '../domain/dateUtils'
import { listEntries } from '../data/entries'
import type { EventSource } from './types'

/** Eigene Einträge und Notizen aus der Datenbank. */
export const ownSource: EventSource = {
  id: 'own',
  label: 'Eigene Einträge',
  isDemo: false,
  load: async (now) => {
    const monday = startOfWeek(now)
    return listEntries(addDays(monday, -400), addDays(monday, 400))
  },
}
