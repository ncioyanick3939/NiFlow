import { parseForecast, parsePlace, parsePlaces } from '../domain/weather'
import type { DayWeather, WeatherPlace } from '../domain/weather'

// Wetter von Open-Meteo (gratis, kein Schlüssel, keine Konten). Gesendet werden nur die Koordinaten des
// gewählten Ortes (Stadtebene), keine persönlichen Daten. Der Ort liegt nur auf diesem Gerät.

const PLACE_KEY = 'niflow.weather-place.v1'
const CACHE_KEY = 'niflow.weather-cache.v1'
const CACHE_MS = 3 * 3600 * 1000
export const FORECAST_DAYS = 14

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Speicher gesperrt: dann geht es ohne
  }
}

export function loadPlace(): WeatherPlace | null {
  try {
    return parsePlace(JSON.parse(read(PLACE_KEY) ?? 'null'))
  } catch {
    return null
  }
}

export function savePlace(place: WeatherPlace | null): void {
  write(PLACE_KEY, place ? JSON.stringify(place) : null)
  write(CACHE_KEY, null)
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<WeatherPlace[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de&format=json`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Die Ortssuche ist gerade nicht erreichbar.')
  return parsePlaces(await res.json().catch(() => null))
}

/** Vorhersage für die nächsten Tage. Gibt bei Fehlern null zurück; das Wetter ist nie lebenswichtig für die App. */
export async function loadForecast(place: WeatherPlace, now = new Date(), signal?: AbortSignal): Promise<DayWeather[] | null> {
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`
  try {
    const c = JSON.parse(read(CACHE_KEY) ?? 'null') as { key?: string; at?: number; days?: DayWeather[] } | null
    if (c && c.key === key && typeof c.at === 'number' && now.getTime() - c.at < CACHE_MS && Array.isArray(c.days) && c.days.length) return c.days
  } catch {
    // Cache kaputt: neu laden
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
    `&timezone=auto&forecast_days=${FORECAST_DAYS}`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const days = parseForecast(await res.json().catch(() => null))
    if (!days.length) return null
    write(CACHE_KEY, JSON.stringify({ key, at: now.getTime(), days }))
    return days
  } catch {
    return null
  }
}
