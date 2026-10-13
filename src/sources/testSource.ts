// TESTDATEN. Diese Termine sind erfunden und dienen nur dazu, die Oberfläche zu prüfen,
// bis Google Kalender verbunden ist. Sie werden in der App immer als "Testdaten" gekennzeichnet.
// Sie sind relativ zur aktuellen Woche, damit immer etwas sichtbar ist.

import { addDays, atTime, startOfDay, startOfWeek } from '../domain/dateUtils'
import { makeEventId } from '../domain/types'
import type { CalendarEvent, Category, EventKind, Intensity } from '../domain/types'
import type { EventSource } from './types'

interface Spec {
  key: string
  day: number // 0 = Montag der aktuellen Woche
  from: string // "HH:MM"
  to: string | null // null = Ende unbekannt
  title: string
  category: Category
  kind?: EventKind
  intensity?: Intensity
  labelId?: string
}

const SPECS: Spec[] = [
  { key: 'mo-swim', day: 0, from: '06:30', to: '07:30', title: 'Schwimmen: Technik', category: 'training', intensity: 'medium' },
  { key: 'mo-work', day: 0, from: '08:00', to: '12:00', title: 'Arbeit', category: 'work' },
  { key: 'mo-lecture', day: 0, from: '13:15', to: '15:00', title: 'Vorlesung Statistik', category: 'study', labelId: 'demo-lab-stat' },
  { key: 'mo-run', day: 0, from: '18:00', to: '19:00', title: 'Lauf: Intervalle', category: 'training', intensity: 'high' },

  { key: 'tu-work', day: 1, from: '08:00', to: '17:00', title: 'Arbeit', category: 'work' },
  { key: 'tu-bike', day: 1, from: '18:30', to: '20:30', title: 'Rennvelo: Grundlage', category: 'training', intensity: 'medium' },
  { key: 'tu-due', day: 1, from: '23:59', to: null, title: 'Abgabe Übung 4', category: 'study', kind: 'deadline' },

  { key: 'we-lec1', day: 2, from: '08:15', to: '10:00', title: 'Vorlesung Datenbanken', category: 'study' },
  { key: 'we-lec2', day: 2, from: '09:45', to: '11:30', title: 'Übung Mathematik', category: 'study' },
  { key: 'we-work', day: 2, from: '12:30', to: '18:30', title: 'Arbeit', category: 'work' },
  { key: 'we-brick', day: 2, from: '19:00', to: '20:30', title: 'Koppeltraining', category: 'training', intensity: 'high' },

  { key: 'th-work', day: 3, from: '07:00', to: '17:30', title: 'Arbeit', category: 'work' },
  { key: 'th-dinner', day: 3, from: '18:30', to: '21:00', title: 'Znacht bei den Grosseltern', category: 'private', labelId: 'demo-lab-fam' },

  { key: 'fr-swim', day: 4, from: '06:30', to: '07:30', title: 'Schwimmen: Ausdauer', category: 'training', intensity: 'medium' },
  { key: 'fr-lecture', day: 4, from: '10:15', to: '12:00', title: 'Vorlesung Software Engineering', category: 'study' },
  { key: 'fr-dinner', day: 4, from: '19:00', to: '22:00', title: 'Abend mit Freundin', category: 'private' },

  { key: 'sa-ride', day: 5, from: '08:00', to: '12:00', title: 'Rennvelo: lange Ausfahrt', category: 'training', intensity: 'high' },
  { key: 'sa-family', day: 5, from: '15:00', to: null, title: 'Familienbesuch', category: 'private', labelId: 'demo-lab-fam' },

  { key: 'su-run', day: 6, from: '09:00', to: '11:00', title: 'Langer Lauf', category: 'training', intensity: 'medium' },

  { key: 'next-exam', day: 8, from: '08:00', to: '09:30', title: 'Prüfung Statistik', category: 'study', kind: 'exam' },
]

function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return atTime(day, h, m)
}

export function createTestEvents(now: Date): CalendarEvent[] {
  const monday = startOfWeek(now)
  const events: CalendarEvent[] = SPECS.map((s) => {
    const day = addDays(monday, s.day)
    return {
      id: makeEventId('test', s.key),
      source: 'test',
      externalId: s.key,
      title: s.title,
      start: at(day, s.from),
      end: s.to ? at(day, s.to) : null,
      allDay: false,
      category: s.category,
      kind: s.kind ?? 'event',
      intensity: s.intensity,
      labelId: s.labelId ?? null,
    }
  })

  // Ein ganztägiger Termin, um die Behandlung von ganztägigen Terminen zu zeigen.
  const friday = addDays(monday, 4)
  events.push({
    id: makeEventId('test', 'fr-birthday'),
    source: 'test',
    externalId: 'fr-birthday',
    title: 'Geburtstag Grossmutter',
    labelId: 'demo-lab-fam',
    start: friday,
    end: addDays(friday, 1),
    allDay: true,
    category: 'private',
    kind: 'event',
  })

  // Mehrtägig mit sehr langem Titel: so etwas kommt aus Google und darf das Layout nicht sprengen
  events.push({
    id: makeEventId('test', 'long-window'),
    source: 'test',
    externalId: 'long-window',
    title: 'Kolloquienwahl-Fenster im Online-Portal für das Herbstsemester (30.09.–18.10.26)',
    start: addDays(monday, -2),
    end: addDays(monday, 6),
    allDay: true,
    category: 'study',
    kind: 'event',
  })

  // Zwei Notizen, um die Notizanzeige zu zeigen
  const today = startOfDay(now)
  events.push(
    {
      id: makeEventId('test', 'note-today'),
      source: 'test',
      externalId: 'note-today',
      title: 'Lernnotizen Statistik',
      description: 'Hypothesentests: Fehler 1. und 2. Art nochmals anschauen.',
      start: today,
      end: addDays(today, 1),
      allDay: true,
      category: 'study',
      kind: 'note',
    },
    {
      id: makeEventId('test', 'note-friday'),
      source: 'test',
      externalId: 'note-friday',
      title: 'Geschenk für Grossmutter abholen',
      start: friday,
      end: addDays(friday, 1),
      allDay: true,
      category: 'private',
      kind: 'note',
    },
  )
  return events
}

export const testSource: EventSource = {
  id: 'test',
  label: 'Testdaten',
  isDemo: true,
  load: async (now) => createTestEvents(now),
}
