import { useCallback, useEffect, useRef, useState } from 'react'
import { advance, alertPlan, configure, createTimer, formatClock, parseTimer, pauseTimer, remainingMs, resetTimer, resumeTimer, startTimer, stopTimer } from '../../domain/timer'
import type { TimerEvent, TimerState } from '../../domain/timer'
import { askNotificationPermission, playChime, syncNativeAlerts, unlockAudio, vibrate, webNotify } from './alarm'

const KEY = 'niflow.timer.v1'

function load(): TimerState {
  try {
    return parseTimer(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? createTimer()
  } catch {
    return createTimer()
  }
}

function save(s: TimerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Speicher gesperrt: der Timer läuft trotzdem, nur nicht über einen Neustart hinaus
  }
}

const MESSAGE: Record<TimerEvent, { title: string; body: (s: TimerState) => string }> = {
  focus_done: { title: 'Pause', body: (s) => `Fokusblock geschafft. ${Math.round(s.durationMs / 60000)} Minuten Pause.` },
  break_done: { title: 'Weiter', body: (s) => `Pause vorbei. Nächster Fokusblock: ${s.focusMin} Minuten.` },
  finished: { title: 'Zeit ist um', body: (s) => `Fokuszeit geschafft: ${Math.round(s.focusedMs / 60000)} Minuten.` },
}

export type TimerApi = ReturnType<typeof useTimer>

/** Der Timer der App. Lebt in der obersten Ebene, damit er weiterläuft, wenn das Fenster zu ist. */
export function useTimer(onMessage: (text: string) => void) {
  const [state, setState] = useState<TimerState>(load)
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)
  stateRef.current = state
  const messageRef = useRef(onMessage)
  messageRef.current = onMessage

  const commit = useCallback((next: TimerState) => {
    stateRef.current = next
    setState(next)
    save(next)
  }, [])

  const tick = useCallback(
    (silent = false) => {
      const t = Date.now()
      setNow(t)
      const { state: next, event } = advance(stateRef.current, t)
      if (event) {
        commit(next)
        const m = MESSAGE[event]
        const text = `${m.title}: ${m.body(next)}`
        messageRef.current(text)
        if (!silent) {
          playChime()
          vibrate()
          webNotify(m.title, m.body(next))
        }
      }
    },
    [commit],
  )

  // Beim Öffnen: ist inzwischen etwas abgelaufen? Dann ohne Ton melden.
  useEffect(() => {
    tick(true)
  }, [tick])

  useEffect(() => {
    if (state.status !== 'running') return
    const id = window.setInterval(() => tick(), 250)
    const onVisible = () => {
      if (!document.hidden) tick(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state.status, tick])

  // Mitteilungen für gesperrten Bildschirm (iOS-App) bei jeder Änderung neu planen
  useEffect(() => {
    void syncNativeAlerts(alertPlan(state, Date.now()))
  }, [state.status, state.endAt, state.phase, state.rounds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restzeit im Tab-Titel, solange der Timer läuft
  const running = state.status === 'running'
  const rest = remainingMs(state, now)
  useEffect(() => {
    if (!running) return
    const original = document.title
    document.title = `${formatClock(rest)} · ${state.phase === 'focus' ? 'Fokus' : 'Pause'} · NiFlow`
    return () => {
      document.title = original
    }
  }, [running, rest, state.phase])

  const start = useCallback(() => {
    unlockAudio()
    void askNotificationPermission().then(() => syncNativeAlerts(alertPlan(stateRef.current, Date.now())))
    commit(startTimer(stateRef.current, Date.now()))
    setNow(Date.now())
  }, [commit])
  const pause = useCallback(() => commit(pauseTimer(stateRef.current, Date.now())), [commit])
  const resume = useCallback(() => {
    unlockAudio()
    commit(resumeTimer(stateRef.current, Date.now()))
    setNow(Date.now())
  }, [commit])
  const stop = useCallback(() => commit(stopTimer(stateRef.current, Date.now())), [commit])
  const reset = useCallback(() => commit(resetTimer(stateRef.current)), [commit])
  const set = useCallback((patch: Parameters<typeof configure>[1]) => commit(configure(stateRef.current, patch)), [commit])

  return { state, now, rest, start, pause, resume, stop, reset, set }
}
