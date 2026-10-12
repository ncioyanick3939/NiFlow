// Google Calendar API v3, nur lesend.
//   Kalenderliste: GET https://www.googleapis.com/calendar/v3/users/me/calendarList
//   Termine:       GET https://www.googleapis.com/calendar/v3/calendars/{id}/events
// Dokumentation: https://developers.google.com/calendar/api/v3/reference/events/list
// Es werden keine Termine geändert, erstellt oder gelöscht.

import { makeEventId } from '../domain/types'
import type { CalendarEvent } from '../domain/types'
import { categorize, guessIntensity } from './categorize'

const API = 'https://www.googleapis.com/calendar/v3'

export interface GoogleDateTime {
  date?: string // Ganztägig: "2026-10-16" (Ende ist exklusiv)
  dateTime?: string // Mit Uhrzeit: "2026-10-16T08:00:00+02:00"
}

export interface GoogleEventItem {
  id: string
  status?: string
  summary?: string
  description?: string
  start?: GoogleDateTime
  end?: GoogleDateTime
  attendees?: { self?: boolean; responseStatus?: string }[]
}

export class GoogleAuthError extends Error {}

/** "2026-10-16" als lokale Mitternacht (nicht UTC, sonst verschiebt sich der Tag). */
function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Wandelt einen Google-Termin in unser Format um. null = überspringen. */
export function mapGoogleEvent(item: GoogleEventItem, calendarId: string): CalendarEvent | null {
  if (item.status === 'cancelled') return null
  if (item.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null
  if (!item.start || !item.end) return null

  const allDay = !!item.start.date
  let start: Date
  let end: Date | null
  if (allDay) {
    if (!item.start.date || !item.end.date) return null
    start = localDate(item.start.date)
    end = localDate(item.end.date)
  } else {
    if (!item.start.dateTime || !item.end.dateTime) return null
    start = new Date(item.start.dateTime)
    end = new Date(item.end.dateTime)
  }
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) return null

  const title = item.summary?.trim() || '(ohne Titel)'
  const category = categorize(title)
  return {
    id: makeEventId('google', `${calendarId}/${item.id}`),
    source: 'google',
    externalId: `${calendarId}/${item.id}`,
    title,
    start,
    end,
    allDay,
    category,
    kind: 'event',
    intensity: guessIntensity(title, category),
    description: item.description,
  }
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new GoogleAuthError('Google-Verbindung abgelaufen. Bitte neu verbinden.')
  if (res.status === 403) throw new Error('Google verweigert den Zugriff (403). Ist die Calendar API aktiv und der Bereich erlaubt?')
  if (!res.ok) throw new Error(`Google Kalender antwortete mit Fehler ${res.status}`)
  return (await res.json()) as T
}

/** Lädt alle angezeigten Kalender des Nutzers für den Zeitraum [from, to). */
export async function fetchGoogleEvents(token: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const list = await getJson<{ items?: { id: string; selected?: boolean }[] }>(
    `${API}/users/me/calendarList?minAccessRole=reader`,
    token,
  )
  const calendars = (list.items ?? []).filter((c) => c.selected)

  const perCalendar = await Promise.all(
    calendars.map(async (cal) => {
      const out: CalendarEvent[] = []
      let pageToken: string | undefined
      do {
        const params = new URLSearchParams({
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: 'true', // Serientermine als einzelne Termine
          orderBy: 'startTime',
          maxResults: '250',
        })
        if (pageToken) params.set('pageToken', pageToken)
        const page = await getJson<{ items?: GoogleEventItem[]; nextPageToken?: string }>(
          `${API}/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          token,
        )
        for (const item of page.items ?? []) {
          const e = mapGoogleEvent(item, cal.id)
          if (e) out.push(e)
        }
        pageToken = page.nextPageToken
      } while (pageToken)
      return out
    }),
  )
  return perCalendar.flat()
}
