import { useCallback, useEffect, useState } from 'react'
import { loadForecast, loadPlace, savePlace } from '../data/weather'
import type { DayWeather, WeatherPlace } from '../domain/weather'

export interface WeatherState {
  place: WeatherPlace | null
  /** null = noch nicht geladen oder nicht verfügbar */
  days: DayWeather[] | null
  loading: boolean
  setPlace: (p: WeatherPlace | null) => void
}

/** Wetter-Ort (nur auf diesem Gerät) und Vorhersage. Ohne Ort wird nichts geladen. */
export function useWeather(enabled: boolean): WeatherState {
  const [place, setPlaceState] = useState<WeatherPlace | null>(() => loadPlace())
  const [days, setDays] = useState<DayWeather[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !place) {
      setDays(null)
      return
    }
    const ctl = new AbortController()
    setLoading(true)
    void loadForecast(place, new Date(), ctl.signal).then((d) => {
      if (ctl.signal.aborted) return
      setDays(d)
      setLoading(false)
    })
    return () => ctl.abort()
  }, [enabled, place])

  const setPlace = useCallback((p: WeatherPlace | null) => {
    savePlace(p)
    setPlaceState(p)
  }, [])

  return { place, days, loading, setPlace }
}
