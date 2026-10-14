// Fokus-Timer: einfacher Countdown oder Pomodoro (Fokus und Pause im Wechsel).
// Reine Logik ohne Oberfläche: Alles läuft über Zeitstempel (Ende = Uhrzeit), nicht über Zählen. Dadurch stimmt der Timer
// auch nach dem Schliessen der App, im Hintergrund oder nach einem Neustart.

import { emptyInput, toDateInput, toTimeInput } from './entries'
import type { EntryInput } from './entries'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done'
export type TimerMode = 'single' | 'pomodoro'
export type TimerPhase = 'focus' | 'break'
export type TimerEvent = 'focus_done' | 'break_done' | 'finished'

export interface TimerState {
  status: TimerStatus
  mode: TimerMode
  phase: TimerPhase
  /** Minuten pro Fokusblock (Einzel-Timer: die gewählte Zeit) */
  focusMin: number
  /** Minuten Pause (Pomodoro); jede 4. Pause dauert dreimal so lang */
  breakMin: number
  /** Länge der laufenden Phase in ms */
  durationMs: number
  /** Ende der laufenden Phase (Epoch ms), nur bei running */
  endAt: number | null
  /** Rest in ms, nur bei paused */
  remainingMs: number
  label: string
  taskId: string | null
  /** Abgeschlossene Fokusblöcke dieser Sitzung */
  rounds: number
  /** Fokuszeit der abgeschlossenen Blöcke in ms */
  focusedMs: number
  /** Beginn der Sitzung (Epoch ms) */
  sessionStart: number | null
}

export const MIN_MINUTES = 1
export const MAX_MINUTES = 240
export const MAX_ROUNDS = 8
export const PRESETS = [15, 25, 45, 60, 90]
const MIN = 60000

export const clampMinutes = (n: number, fallback = 25): number => (Number.isFinite(n) ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n))) : fallback)

export function createTimer(prefs: Partial<Pick<TimerState, 'mode' | 'focusMin' | 'breakMin' | 'label' | 'taskId'>> = {}): TimerState {
  const focusMin = clampMinutes(prefs.focusMin ?? 25)
  return {
    status: 'idle',
    mode: prefs.mode === 'pomodoro' ? 'pomodoro' : 'single',
    phase: 'focus',
    focusMin,
    breakMin: clampMinutes(prefs.breakMin ?? 5, 5),
    durationMs: focusMin * MIN,
    endAt: null,
    remainingMs: focusMin * MIN,
    label: (prefs.label ?? '').slice(0, 80),
    taskId: prefs.taskId ?? null,
    rounds: 0,
    focusedMs: 0,
    sessionStart: null,
  }
}

/** Einstellungen ändern, solange nichts läuft. Läuft der Timer, bleibt er unverändert. */
export function configure(s: TimerState, patch: Partial<Pick<TimerState, 'mode' | 'focusMin' | 'breakMin' | 'label' | 'taskId'>>): TimerState {
  if (s.status === 'running' || s.status === 'paused') return s
  const base = s.status === 'done' ? createTimer(s) : s
  return createTimer({ mode: base.mode, focusMin: base.focusMin, breakMin: base.breakMin, label: base.label, taskId: base.taskId, ...patch })
}

export function startTimer(s: TimerState, now: number): TimerState {
  if (s.status === 'running') return s
  if (s.status === 'paused') return resumeTimer(s, now)
  const fresh = createTimer(s)
  const durationMs = fresh.focusMin * MIN
  return { ...fresh, status: 'running', phase: 'focus', durationMs, remainingMs: durationMs, endAt: now + durationMs, sessionStart: now }
}

export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.status !== 'running' || s.endAt === null) return s
  return { ...s, status: 'paused', remainingMs: Math.max(s.endAt - now, 0), endAt: null }
}

export function resumeTimer(s: TimerState, now: number): TimerState {
  if (s.status !== 'paused') return s
  return { ...s, status: 'running', endAt: now + s.remainingMs }
}

/** Vorzeitig beenden: Die bisherige Fokuszeit bleibt (zum Speichern), sonst geht der Timer in den Leerlauf. */
export function stopTimer(s: TimerState, now: number): TimerState {
  if (s.status !== 'running' && s.status !== 'paused') return s
  const focusedMs = focusedSoFar(s, now)
  if (focusedMs < MIN) return resetTimer(s)
  return { ...s, status: 'done', endAt: null, remainingMs: 0, focusedMs }
}

/** Alles zurück auf Anfang, Einstellungen bleiben. */
export function resetTimer(s: TimerState): TimerState {
  return createTimer({ mode: s.mode, focusMin: s.focusMin, breakMin: s.breakMin })
}

export function remainingMs(s: TimerState, now: number): number {
  if (s.status === 'running' && s.endAt !== null) return Math.max(s.endAt - now, 0)
  if (s.status === 'paused') return s.remainingMs
  if (s.status === 'done') return 0
  return s.focusMin * MIN
}

/** 0 bis 1, wie viel der laufenden Phase schon vorbei ist. */
export function progress(s: TimerState, now: number): number {
  if (s.status === 'idle') return 0
  if (s.status === 'done') return 1
  const total = s.durationMs || 1
  return Math.min(Math.max(1 - remainingMs(s, now) / total, 0), 1)
}

const breakMsAfter = (s: TimerState, rounds: number): number => (rounds % 4 === 0 ? s.breakMin * 3 : s.breakMin) * MIN

/** Was passiert, wenn die laufende Phase um `at` endet? */
function transition(s: TimerState, at: number): { state: TimerState; event: TimerEvent } {
  if (s.phase === 'focus') {
    const rounds = s.rounds + 1
    const focusedMs = s.focusedMs + s.durationMs
    if (s.mode === 'single' || rounds >= MAX_ROUNDS) {
      return { state: { ...s, status: 'done', rounds, focusedMs, endAt: null, remainingMs: 0 }, event: 'finished' }
    }
    const durationMs = breakMsAfter(s, rounds)
    return { state: { ...s, phase: 'break', rounds, focusedMs, durationMs, remainingMs: durationMs, endAt: at + durationMs }, event: 'focus_done' }
  }
  const durationMs = s.focusMin * MIN
  return { state: { ...s, phase: 'focus', durationMs, remainingMs: durationMs, endAt: at + durationMs }, event: 'break_done' }
}

/**
 * Prüft, ob die laufende Phase vorbei ist, und schaltet um. Pro Aufruf höchstens ein Übergang:
 * War die App lange zu, beginnt die nächste Phase ab jetzt und nicht rückwirkend.
 */
export function advance(s: TimerState, now: number): { state: TimerState; event: TimerEvent | null } {
  if (s.status !== 'running' || s.endAt === null || now < s.endAt) return { state: s, event: null }
  return transition(s, now)
}

export interface PlannedAlert {
  /** Zeitpunkt (Epoch ms) */
  at: number
  title: string
  body: string
}

/** Die nächsten Signale (für Mitteilungen, die auch bei geschlossener App kommen). Bei einer Pause: keine. */
export function alertPlan(s: TimerState, now: number, max = 6): PlannedAlert[] {
  if (s.status !== 'running' || s.endAt === null) return []
  const out: PlannedAlert[] = []
  let cur: TimerState = s
  let at = s.endAt
  for (let i = 0; i < max && at > now; i++) {
    const { state, event } = transition(cur, at)
    const what = cur.label ? ` «${cur.label}»` : ''
    if (event === 'focus_done') out.push({ at, title: 'Pause', body: `Fokusblock${what} geschafft. ${Math.round(state.durationMs / MIN)} Minuten Pause.` })
    else if (event === 'break_done') out.push({ at, title: 'Weiter', body: `Die Pause ist vorbei. Nächster Fokusblock${what}: ${state.focusMin} Minuten.` })
    else out.push({ at, title: 'Zeit ist um', body: `Fokuszeit${what} geschafft: ${Math.round(state.focusedMs / MIN)} Minuten.` })
    if (event === 'finished') break
    cur = state
    at = state.endAt!
  }
  return out
}

/** Fokuszeit bisher in ms (abgeschlossene Blöcke plus der angefangene). */
export function focusedSoFar(s: TimerState, now: number): number {
  if (s.phase === 'focus' && (s.status === 'running' || s.status === 'paused')) {
    return s.focusedMs + Math.max(s.durationMs - remainingMs(s, now), 0)
  }
  return s.focusedMs
}

/** Was als Lernzeit gespeichert werden kann: Beginn und volle Minuten Fokuszeit. null, wenn noch zu wenig. */
export function sessionBlock(s: TimerState, now: number): { start: Date; minutes: number } | null {
  if (s.sessionStart === null) return null
  const minutes = Math.floor(focusedSoFar(s, now) / MIN)
  if (minutes < 1) return null
  return { start: new Date(s.sessionStart), minutes }
}

/** «24:59», ab einer Stunde «1:05:00». Rundet auf: bei 0,2 Sekunden Rest steht noch 0:01. */
export function formatClock(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Lernzeit als Termin: Beginn der Sitzung, Dauer = Fokuszeit. Über Mitternacht wird bei 23:59 abgeschnitten. */
export function timerEntryInput(block: { start: Date; minutes: number }, label: string, taskId: string | null): EntryInput {
  const end = new Date(block.start.getTime() + block.minutes * MIN)
  const sameDay = toDateInput(end) === toDateInput(block.start)
  return {
    ...emptyInput('event', block.start),
    title: label.trim() || 'Fokuszeit',
    category: 'study',
    allDay: false,
    date: toDateInput(block.start),
    startTime: toTimeInput(block.start),
    endTime: sameDay ? toTimeInput(end) : '23:59',
    taskId,
    priority: null,
    reminderMinutes: null,
  }
}

// Speichern (localStorage): alles wird beim Lesen geprüft.
const STATUS: TimerStatus[] = ['idle', 'running', 'paused', 'done']
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function parseTimer(raw: unknown): TimerState | null {
  const r = raw as Partial<TimerState> | null
  if (!r || typeof r !== 'object' || !STATUS.includes(r.status as TimerStatus)) return null
  const base = createTimer({ mode: r.mode, focusMin: finite(r.focusMin) ? r.focusMin : 25, breakMin: finite(r.breakMin) ? r.breakMin : 5, label: typeof r.label === 'string' ? r.label : '', taskId: typeof r.taskId === 'string' ? r.taskId : null })
  if (r.status === 'idle') return base
  if (!finite(r.durationMs) || r.durationMs <= 0 || r.durationMs > MAX_MINUTES * 3 * MIN) return base
  const s: TimerState = {
    ...base,
    status: r.status as TimerStatus,
    phase: r.phase === 'break' ? 'break' : 'focus',
    durationMs: r.durationMs,
    endAt: finite(r.endAt) ? r.endAt : null,
    remainingMs: finite(r.remainingMs) ? Math.max(r.remainingMs, 0) : 0,
    rounds: finite(r.rounds) ? Math.min(Math.max(Math.round(r.rounds), 0), MAX_ROUNDS) : 0,
    focusedMs: finite(r.focusedMs) ? Math.max(r.focusedMs, 0) : 0,
    sessionStart: finite(r.sessionStart) ? r.sessionStart : null,
  }
  if (s.status === 'running' && s.endAt === null) return base
  return s
}
