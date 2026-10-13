import { useMemo, useState } from 'react'
import type { Exam } from '../domain/exams'
import { daysUntil } from '../domain/exams'
import { recentNotes, search } from '../domain/search'
import type { Task } from '../domain/tasks'
import type { CalendarEvent } from '../domain/types'
import Icon from './icons'
import { EventRow } from './kit'
import { countdownLabel } from './exams/ExamDetail'
import TaskRow from './tasks/TaskRow'

interface Props {
  events: CalendarEvent[]
  tasks: Task[]
  exams: Exam[]
  now: Date
  readOnly: boolean
  onOpenEvent: (e: CalendarEvent) => void
  onOpenTask: (t: Task) => void
  onToggleTask: (t: Task) => void
  onOpenExam: (x: Exam) => void
}

export default function SearchPanel(p: Props) {
  const [q, setQ] = useState('')
  const results = useMemo(() => search(q, { events: p.events, tasks: p.tasks, exams: p.exams }, p.now), [q, p.events, p.tasks, p.exams, p.now])
  const notes = useMemo(() => recentNotes(p.events), [p.events])
  const total = results.notes.length + results.events.length + results.tasks.length + results.exams.length
  const examById = new Map(p.exams.map((x) => [x.id, x]))

  return (
    <div>
      <div className="relative mb-4">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <label htmlFor="search" className="sr-only">Suchen</label>
        <input
          id="search"
          data-autofocus
          type="search"
          className="field pl-10 text-base"
          placeholder="Notizen, Termine, Aufgaben, Prüfungen …"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </div>

      {!q.trim() ? (
        <section>
          <h3 className="eyebrow mb-1">Letzte Notizen</h3>
          {notes.length === 0 ? (
            <p className="py-3 text-sm text-muted">Noch keine Notizen. Notizen legst du im Kalender oder in der Übersicht an.</p>
          ) : (
            notes.map((e) => <EventRow key={e.id} e={e} onOpen={p.onOpenEvent} showDay />)
          )}
        </section>
      ) : total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nichts gefunden für «{q.trim()}».</p>
      ) : (
        <div className="space-y-5">
          {results.notes.length > 0 && (
            <section>
              <h3 className="eyebrow mb-1">Notizen</h3>
              {results.notes.map((e) => <EventRow key={e.id} e={e} onOpen={p.onOpenEvent} showDay />)}
            </section>
          )}
          {results.tasks.length > 0 && (
            <section>
              <h3 className="eyebrow mb-1">Aufgaben</h3>
              {results.tasks.map((t) => (
                <TaskRow key={t.id} task={t} now={p.now} exam={t.examId ? examById.get(t.examId) : undefined} readOnly={p.readOnly} onToggle={p.onToggleTask} onOpen={p.onOpenTask} compact />
              ))}
            </section>
          )}
          {results.exams.length > 0 && (
            <section>
              <h3 className="eyebrow mb-1">Prüfungen</h3>
              {results.exams.map((x) => (
                <button key={x.id} type="button" onClick={() => p.onOpenExam(x)} className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-surface2">
                  <Icon name="exam" size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.title}</span>
                  <span className="shrink-0 text-xs text-muted">{countdownLabel(daysUntil(x, p.now))}</span>
                </button>
              ))}
            </section>
          )}
          {results.events.length > 0 && (
            <section>
              <h3 className="eyebrow mb-1">Termine</h3>
              {results.events.map((e) => <EventRow key={e.id} e={e} onOpen={p.onOpenEvent} showDay dim={(e.end ?? e.start) < p.now} />)}
            </section>
          )}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">
        Gesucht wird in allen geladenen Daten: eigene Einträge, Aufgaben und Prüfungen vollständig, Google und Intervals im geladenen Zeitraum.
      </p>
    </div>
  )
}
