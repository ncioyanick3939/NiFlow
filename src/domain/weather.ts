// Wetter für die Planung: Vorhersage-Daten lesen, in Worte fassen und für draussen einstufen.
// Reine Logik ohne Netzwerk, damit sie getestet werden kann. Die Daten kommen von Open-Meteo (open-meteo.com).

export interface DayWeather {
  /** yyyy-MM-dd */
  date: string
  /** WMO-Wettercode */
  code: number
  tMax: number
  tMin: number
  /** Niederschlag in mm */
  precipMm: number
  /** Regenwahrscheinlichkeit in Prozent, null wenn unbekannt */
  precipProb: number | null
  /** Wind in km/h (Maximum) */
  windMax: number
}

export type OutdoorRating = 'gut' | 'mittel' | 'schlecht'

/** Ab diesem Tag (0 = heute) sind Vorhersagen deutlich unsicherer. */
export const UNSURE_FROM_DAY = 7

export function describeCode(code: number): string {
  if (code === 0) return 'klar'
  if (code === 1) return 'überwiegend klar'
  if (code === 2) return 'teils bewölkt'
  if (code === 3) return 'bedeckt'
  if (code === 45 || code === 48) return 'Nebel'
  if (code >= 51 && code <= 55) return 'Nieselregen'
  if (code === 56 || code === 57) return 'gefrierender Nieselregen'
  if (code === 61) return 'leichter Regen'
  if (code === 63) return 'Regen'
  if (code === 65) return 'starker Regen'
  if (code === 66 || code === 67) return 'gefrierender Regen'
  if (code === 71 || code === 73 || code === 75 || code === 77) return 'Schnee'
  if (code >= 80 && code <= 82) return 'Regenschauer'
  if (code === 85 || code === 86) return 'Schneeschauer'
  if (code === 95) return 'Gewitter'
  if (code === 96 || code === 99) return 'Gewitter mit Hagel'
  return 'wechselhaft'
}

const isSnowOrStorm = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86 || c >= 95 || c === 66 || c === 67

/** Taugt der Tag für Sport draussen (Velo, Laufen)? Bewusst einfach und nachvollziehbar. */
export function outdoorRating(d: DayWeather): OutdoorRating {
  const prob = d.precipProb ?? (d.precipMm >= 1 ? 80 : 0)
  if (isSnowOrStorm(d.code) || prob >= 60 || d.precipMm >= 3 || d.windMax >= 45 || d.tMax < 2 || d.tMax > 33) return 'schlecht'
  if (prob <= 25 && d.precipMm < 1 && d.windMax < 30 && d.tMax >= 8 && d.tMax <= 30) return 'gut'
  return 'mittel'
}

const round = (n: number) => Math.round(n)

/** Eine Zeile ohne Datum, z. B. «teils bewölkt, 6 bis 13 °C, Regen 70 % (3 mm), Wind bis 25 km/h». */
export function describeDay(d: DayWeather): string {
  const parts = [describeCode(d.code), `${round(d.tMin)} bis ${round(d.tMax)} °C`]
  if (d.precipProb !== null || d.precipMm >= 0.5) {
    parts.push(`Regen ${d.precipProb !== null ? `${round(d.precipProb)} %` : 'möglich'}${d.precipMm >= 0.5 ? ` (${d.precipMm.toFixed(d.precipMm >= 10 ? 0 : 1)} mm)` : ''}`)
  }
  if (d.windMax >= 20) parts.push(`Wind bis ${round(d.windMax)} km/h`)
  return parts.join(', ')
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Antwort von Open-Meteo (daily) in unsere Form bringen. Unvollständige Tage werden weggelassen. */
export function parseForecast(raw: unknown): DayWeather[] {
  const daily = (raw as { daily?: Record<string, unknown> } | null)?.daily
  if (!daily || !Array.isArray(daily.time)) return []
  const arr = (k: string): unknown[] => (Array.isArray(daily[k]) ? (daily[k] as unknown[]) : [])
  const code = arr('weather_code')
  const tMax = arr('temperature_2m_max')
  const tMin = arr('temperature_2m_min')
  const mm = arr('precipitation_sum')
  const prob = arr('precipitation_probability_max')
  const wind = arr('wind_speed_10m_max')
  const out: DayWeather[] = []
  ;(daily.time as unknown[]).forEach((t, i) => {
    const c = num(code[i])
    const hi = num(tMax[i])
    const lo = num(tMin[i])
    if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t) || c === null || hi === null || lo === null) return
    out.push({ date: t, code: c, tMax: hi, tMin: lo, precipMm: num(mm[i]) ?? 0, precipProb: num(prob[i]), windMax: num(wind[i]) ?? 0 })
  })
  return out
}

/** Gespeicherter Ort: nur Name und Koordinaten (auf Stadtebene). */
export interface WeatherPlace {
  name: string
  lat: number
  lon: number
}

export function parsePlace(raw: unknown): WeatherPlace | null {
  const p = raw as Partial<WeatherPlace> | null
  if (!p || typeof p.name !== 'string' || !p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') return null
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null
  return { name: p.name.slice(0, 80), lat: p.lat, lon: p.lon }
}

/** Treffer der Ortssuche (Open-Meteo Geocoding) in Orte umwandeln. */
export function parsePlaces(raw: unknown): WeatherPlace[] {
  const list = (raw as { results?: unknown } | null)?.results
  if (!Array.isArray(list)) return []
  const out: WeatherPlace[] = []
  for (const r of list.slice(0, 6)) {
    const x = r as { name?: unknown; admin1?: unknown; country?: unknown; latitude?: unknown; longitude?: unknown }
    if (typeof x.name !== 'string') continue
    const region = typeof x.admin1 === 'string' && x.admin1 && x.admin1 !== x.name ? `, ${x.admin1}` : ''
    const country = typeof x.country === 'string' && x.country ? `, ${x.country}` : ''
    const place = parsePlace({ name: `${x.name}${region}${country}`, lat: x.latitude, lon: x.longitude })
    if (place) out.push(place)
  }
  return out
}
