import { useState } from 'react'
import { clampMinutes, focusedSoFar, formatClock, progress, PRESETS, sessionBlock, timerEntryInput } from '../../domain/timer'
import type { TimerState } from '../../domain/timer'
import type { EntryInput } from '../../domain/entries'
import type { Task } from '../../domain/tasks'
import Icon from '../icons'
import { Segmented } from '../kit'
import { alertsWhenClosed } from './alarm'
import type { TimerApi } from './useTimer'

interface Props {
  timer: TimerApi
  /** Offene Aufgaben zum Verknüpfen */
  tasks: Task[]
  /** Lernzeit als Termin speichern (fehlt in der Demo) */
  onSaveSession?: (input: EntryInput) => Promise<void>
}

const SIZE = 248
const R = 108
const C = 2 * Math.PI * R

function Ring({ s, rest, now }: { s: TimerState; rest: number; now: number }) {
  const p = progress(s, now)
  const phase = s.status === 'idle' ? 'Bereit' : s.status === 'done' ? 'Geschafft' : s.phase === 'focus' ? 'Fokus' : 'Pause'
  const color = s.phase === 'break' && s.status !== 'done' ? 'rgb(var(--study))' : 'rgb(var(--accent))'
  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }} role="timer" aria-label={`${phase}, noch ${formatClock(rest)}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="10" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{phase}</span>
        <span className="tnum text-[52px] font-extrabold leading-none tracking-tight">{s.status === 'done' ? '0:00' : formatClock(rest)}</span>
        {s.mode === 'pomodoro' && s.status !== 'idle' && <span className="mt-1 text-xs font-medium text-muted">Block {Math.min(s.rounds + (s.phase === 'focus' && s.status !== 'done' ? 1 : 0), 8)}</span>}
      </div>
    </div>
  )
}

function Stepper({ value, onChange, label, step = 5 }: { value: number; onChange: (n: number) => void; label: string; step?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface2 p-1" role="group" aria-label={label}>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold hover:bg-surface" aria-label={`${label} verringern`} onClick={() => onChange(clampMinutes(value - step))}>
        –
      </button>
      <span className="tnum min-w-[4.5rem] text-center text-[15px] font-bold">{value} min</span>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold hover:bg-surface" aria-label={`${label} erhöhen`} onClick={() => onChange(clampMinutes(value + step))}>
        +
      </button>
    </div>
  )
}

export default function TimerPanel({ timer, tasks, onSaveSession }: Props) {
  const { state: s, now, rest } = timer
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idle = s.status === 'idle'
  const block = s.status === 'done' ? sessionBlock(s, now) : null
  const taskTitle = tasks.find((t) => t.id === s.taskId)?.title ?? ''

  const save = async () => {
    if (!block || !onSaveSession) return
    setSaving(true)
    setError(null)
    try {
      await onSaveSession(timerEntryInput(block, s.label || taskTitle, s.taskId))
      setSaved(`${block.minutes} Minuten im Kalender gespeichert.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-2">
      <Ring s={s} rest={rest} now={now} />

      {idle && (
        <div className="space-y-5">
          <div className="flex justify-center">
            <Segmented
              label="Art"
              value={s.mode}
              onChange={(mode) => timer.set({ mode })}
              options={[
                { value: 'single', label: 'Einmal' },
                { value: 'pomodoro', label: 'Pomodoro' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-center text-xs font-semibold text-muted">{s.mode === 'pomodoro' ? 'Fokus pro Block' : 'Dauer'}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={s.focusMin === m}
                  onClick={() => timer.set({ focusMin: m })}
                  className={`tnum min-h-10 rounded-full px-4 text-sm font-bold transition ${s.focusMin === m ? 'bg-accent text-accentink' : 'bg-surface2 text-ink hover:bg-surface2/70'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <Stepper value={s.focusMin} onChange={(m) => timer.set({ focusMin: m })} label="Dauer" />
            </div>
          </div>
          {s.mode === 'pomodoro' && (
            <div className="space-y-2">
              <p className="text-center text-xs font-semibold text-muted">Pause (jede vierte ist dreimal so lang)</p>
              <div className="flex justify-center">
                <Stepper value={s.breakMin} onChange={(m) => timer.set({ breakMin: m })} label="Pause" step={1} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted" htmlFor="timer-label">
              Woran arbeitest du? (optional)
            </label>
            <input id="timer-label" className="field w-full" value={s.label} maxLength={80} placeholder="z. B. Statistik: Zusammenfassung" onChange={(e) => timer.set({ label: e.target.value })} />
            {tasks.length > 0 && (
              <select
                aria-label="Aufgabe verknüpfen"
                className="field w-full"
                value={s.taskId ?? ''}
                onChange={(e) => {
                  const t = tasks.find((x) => x.id === e.target.value)
                  timer.set({ taskId: t?.id ?? null, ...(t && !s.label.trim() ? { label: t.title.slice(0, 80) } : {}) })
                }}
              >
                <option value="">Keine Aufgabe verknüpfen</option>
                {tasks.slice(0, 60).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button type="button" className="btn-primary min-h-14 w-full text-[17px]" onClick={timer.start}>
            <Icon name="timer" size={20} /> {s.mode === 'pomodoro' ? 'Pomodoro starten' : `${s.focusMin} Minuten starten`}
          </button>
        </div>
      )}

      {(s.status === 'running' || s.status === 'paused') && (
        <div className="space-y-4">
          {(s.label || taskTitle) && <p className="truncate text-center text-[15px] font-semibold">{s.label || taskTitle}</p>}
          <div className="flex gap-3">
            {s.status === 'running' ? (
              <button type="button" className="btn-outline min-h-14 flex-1 text-[17px]" onClick={timer.pause}>
                Pause
              </button>
            ) : (
              <button type="button" className="btn-primary min-h-14 flex-1 text-[17px]" onClick={timer.resume}>
                Weiter
              </button>
            )}
            <button type="button" className="btn-ghost min-h-14 flex-1 text-muted" onClick={timer.stop}>
              {focusedSoFar(s, now) >= 60000 ? 'Beenden' : 'Abbrechen'}
            </button>
          </div>
          <p className="text-center text-xs text-muted">
            {alertsWhenClosed() ? 'Du bekommst eine Mitteilung, auch wenn der Bildschirm gesperrt ist.' : 'Ton und Vibration kommen, solange NiFlow offen ist (auch im Hintergrund-Tab).'}
          </p>
        </div>
      )}

      {s.status === 'done' && (
        <div className="space-y-4 text-center">
          <p className="text-[17px] font-bold">{Math.round(s.focusedMs / 60000)} Minuten Fokuszeit{s.rounds > 1 ? ` in ${s.rounds} Blöcken` : ''}</p>
          {saved ? (
            <p role="status" className="text-sm font-semibold text-accent">{saved}</p>
          ) : (
            <>
              {block && onSaveSession && (
                <button type="button" className="btn-primary min-h-12 w-full" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Speichert …' : `Als Lernzeit speichern (${block.minutes} min)`}
                </button>
              )}
              {!onSaveSession && <p className="text-xs text-muted">Zum Speichern als Lernzeit bitte anmelden.</p>}
            </>
          )}
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <button
            type="button"
            className="btn-outline min-h-12 w-full"
            onClick={() => {
              setSaved(null)
              setError(null)
              timer.reset()
            }}
          >
            Neuer Timer
          </button>
        </div>
      )}
    </div>
  )
}
