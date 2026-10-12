import { useState } from 'react'
import type { FormEvent } from 'react'
import { PREP_LABEL, validateExam } from '../../domain/exams'
import type { ExamErrors, ExamInput, PrepStatus } from '../../domain/exams'
import { PRIORITY_LABEL } from '../../domain/types'
import type { Priority } from '../../domain/types'
import Icon from '../icons'
import { Segmented } from '../kit'

interface Props {
  initial: ExamInput
  editing: boolean
  onSave: (v: ExamInput) => Promise<void>
  onCancel: () => void
}

export default function ExamForm({ initial, editing, onSave, onCancel }: Props) {
  const [v, setV] = useState<ExamInput>(initial)
  const [errors, setErrors] = useState<ExamErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const set = <K extends keyof ExamInput>(k: K, value: ExamInput[K]) => setV((p) => ({ ...p, [k]: value }))
  const [more, setMore] = useState(editing || !!(initial.description || initial.notes))

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const found = validateExam(v)
    setErrors(found ?? {})
    if (found) return
    setBusy(true)
    setFailure(null)
    try {
      await onSave(v)
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
      setBusy(false)
    }
  }
  const err = (k: keyof ExamErrors) => (errors[k] ? <p className="mt-1 text-xs text-danger" role="alert">{errors[k]}</p> : null)

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="x-title">Name der Prüfung</label>
          <input id="x-title" data-autofocus className="field" value={v.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Statistik Modulprüfung" aria-invalid={!!errors.title} />
          {err('title')}
        </div>
        <div>
          <label className="label" htmlFor="x-subject">Fach oder Modul</label>
          <input id="x-subject" className="field" value={v.subject} maxLength={120} onChange={(e) => set('subject', e.target.value)} placeholder="z. B. Statistik 1" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="x-date">Datum</label>
          <input id="x-date" type="date" className="field tnum" value={v.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} />
          {err('date')}
        </div>
        <div>
          <label className="label" htmlFor="x-start">Beginn</label>
          <input id="x-start" type="time" className="field tnum" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} aria-invalid={!!errors.startTime} />
          {err('startTime')}
        </div>
        <div>
          <label className="label" htmlFor="x-end">Ende</label>
          <input id="x-end" type="time" className="field tnum" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} aria-invalid={!!errors.endTime} />
          {err('endTime')}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="x-loc">Ort</label>
          <input id="x-loc" className="field" value={v.location} maxLength={200} onChange={(e) => set('location', e.target.value)} placeholder="Raum, Gebäude oder online" />
        </div>
        <div>
          <label className="label" htmlFor="x-format">Format</label>
          <input id="x-format" className="field" value={v.format} maxLength={120} onChange={(e) => set('format', e.target.value)} placeholder="Schriftlich, mündlich, Open Book …" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="x-topics">Lernstoff und Themen</label>
        <textarea id="x-topics" rows={3} className="field py-2" value={v.topics} maxLength={5000} onChange={(e) => set('topics', e.target.value)} placeholder="Ein Thema pro Zeile" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <span className="label">Vorbereitung</span>
          <Segmented<PrepStatus> label="Vorbereitung" size="sm" value={v.prepStatus} onChange={(s) => set('prepStatus', s)} options={(['not_started', 'in_progress', 'ready'] as PrepStatus[]).map((s) => ({ value: s, label: PREP_LABEL[s] }))} />
        </div>
        <div>
          <span className="label">Priorität</span>
          <Segmented<Priority> label="Priorität" size="sm" value={v.priority} onChange={(p) => set('priority', p)} options={(['medium', 'high', 'urgent'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        </div>
      </div>
      {more ? (
        <>
          <div>
            <label className="label" htmlFor="x-desc">Beschreibung</label>
            <textarea id="x-desc" rows={2} className="field py-2" value={v.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} placeholder="Erlaubte Hilfsmittel, Gewichtung …" />
          </div>
          <div>
            <label className="label" htmlFor="x-notes">Persönliche Notizen</label>
            <textarea id="x-notes" rows={3} className="field py-2" value={v.notes} maxLength={5000} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </>
      ) : (
        <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => setMore(true)}>
          + Beschreibung und Notizen
        </button>
      )}
      {errors.text && <p className="text-xs text-danger" role="alert">{errors.text}</p>}
      {failure && (
        <p className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {failure}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Abbrechen</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Speichert …' : editing ? 'Speichern' : 'Prüfung anlegen'}</button>
      </div>
    </form>
  )
}
