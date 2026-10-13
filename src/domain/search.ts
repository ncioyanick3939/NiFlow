// Suche über eigene und importierte Daten. Gross/klein, Umlaute und Akzente werden ignoriert
// ("prufung" findet "Prüfung"). Mehrere Wörter müssen alle vorkommen.

import type { Exam } from './exams'
import type { Task } from './tasks'
import type { CalendarEvent } from './types'

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export interface SearchResults {
  notes: CalendarEvent[]
  events: CalendarEvent[]
  tasks: Task[]
  exams: Exam[]
}

function matches(haystack: string[], words: string[]): boolean {
  const text = normalize(haystack.join(' \n '))
  return words.every((w) => text.includes(w))
}

/**
 * Sucht in Titeln, Beschreibungen und Notizen. Serien erscheinen nur einmal
 * (das nächste Vorkommen ab jetzt, sonst das letzte). Höchstens `limit` Treffer pro Gruppe.
 */
export function search(
  query: string,
  data: { events: CalendarEvent[]; tasks: Task[]; exams: Exam[] },
  now: Date,
  limit = 20,
): SearchResults {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const empty: SearchResults = { notes: [], events: [], tasks: [], exams: [] }
  if (words.length === 0) return empty

  // Aufgaben und Prüfungen werden unten direkt durchsucht, nicht über ihre Kalendereinträge
  const calendar = data.events.filter((e) => e.kind !== 'task' && e.ref?.type !== 'exam')
  const bySeries = new Map<string, CalendarEvent>()
  for (const e of calendar) {
    if (!matches([e.title, e.description ?? ''], words)) continue
    const key = e.ref?.type === 'entry' ? `entry:${e.ref.id}` : e.id
    const prev = bySeries.get(key)
    if (!prev) {
      bySeries.set(key, e)
      continue
    }
    // Bevorzugt das nächste kommende Vorkommen
    const better = e.start >= now ? (prev.start < now || e.start < prev.start) : prev.start < now && e.start > prev.start
    if (better) bySeries.set(key, e)
  }
  const hits = [...bySeries.values()].sort((a, b) => {
    // Kommendes zuerst (aufsteigend), danach Vergangenes (neueste zuerst)
    const fa = a.start >= now
    const fb = b.start >= now
    if (fa !== fb) return fa ? -1 : 1
    return fa ? a.start.getTime() - b.start.getTime() : b.start.getTime() - a.start.getTime()
  })

  return {
    notes: hits.filter((e) => e.kind === 'note').slice(0, limit),
    events: hits.filter((e) => e.kind !== 'note').slice(0, limit),
    tasks: data.tasks
      .filter((t) => matches([t.title, t.description], words))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
      .slice(0, limit),
    exams: data.exams
      .filter((x) => matches([x.title, x.subject, x.topics, x.notes, x.description, x.location], words))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, limit),
  }
}

/** Notizen nach Datum, neueste zuerst (für die Ansicht ohne Suchbegriff). */
export function recentNotes(events: CalendarEvent[], limit = 12): CalendarEvent[] {
  const seen = new Set<string>()
  return events
    .filter((e) => e.kind === 'note')
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .filter((e) => {
      const k = e.ref?.id ?? e.id
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, limit)
}
