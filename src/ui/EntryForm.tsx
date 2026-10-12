import { useState } from 'react'
import type { FormEvent } from 'react'
import { validateEntry } from '../domain/entries'
import type { EntryErrors, EntryInput } from '../domain/entries'
import { PRIORITY_LABEL } from '../domain/types'
import type { Priority } from '../domain/types'
import Icon from './icons'
import { CATEGORIES, CATEGORY_LABEL, Segmented, catClass } from './kit'

interface Props {
  initial: EntryInput
  /** true = bestehender Eintrag (Art ist dann fest). */
  editing: boolean
  onSave: (input: EntryInput) => Promise<void>
  onCancel: () => void
  /** Name der verknüpften Prüfung (Lerntermin), falls vorhanden. */
  examName?: string
}

const PRIORITIES: (Priority | null)[] = [null, 'low', 'medium', 'high', 'urgent']

export default function EntryForm({ initial, editing, onSave, onCancel, examName }: Props) {
  const [v, setV] = useState<EntryInput>(initial)
  const [errors, setErrors] = useState<EntryErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const set = <K extends keyof EntryInput>(k: K, value: EntryInput[K]) => setV((prev) => ({ ...prev, [k]: value }))
  const isNote = v.type === 'note'

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const found = validateEntry(v)
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

  const err = (k: keyof EntryErrors) =>
    errors[k] ? (
      <p className="mt-1 text-xs text-danger" role="alert">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!editing && (
        <Segmented
          label="Art des Eintrags"
          value={v.type}
          onChange={(t) => setV((prev) => ({ ...prev, type: t, allDay: t === 'note' ? true : false }))}
          options={[
            { value: 'event', label: 'Termin' },
            { value: 'note', label: 'Notiz' },
          ]}
        />
      )}

      {v.examId && examName && (
        <p className="flex items-center gap-2 rounded-md bg-surface2 px-3 py-2 text-sm">
          <Icon name="exam" size={15} className="shrink-0 text-muted" />
          <span className="mr-auto">Lerntermin für <strong className="font-medium">{examName}</strong></span>
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => set('examId', null)}>Lösen</button>
        </p>
      )}

      <div>
        <label className="label" htmlFor="f-title">
          {isNote ? 'Titel der Notiz' : 'Titel'}
        </label>
        <input
          id="f-title"
          data-autofocus
          className="field text-base"
          value={v.title}
          maxLength={200}
          onChange={(e) => set('title', e.target.value)}
          placeholder={isNote ? 'z. B. Lernnotizen Statistik' : 'z. B. Zahnarzt, Lernblock, Vorlesung'}
          aria-invalid={!!errors.title}
        />
        {err('title')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={isNote ? 'col-span-2' : ''}>
          <label className="label" htmlFor="f-date">
            Datum
          </label>
          <input id="f-date" type="date" className="field tnum" value={v.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} />
          {err('date')}
        </div>
        {!isNote && (
          <div className="flex items-end">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={v.allDay} onChange={(e) => set('allDay', e.target.checked)} />
              Ganztägig
            </label>
          </div>
        )}
        {!isNote && !v.allDay && (
          <>
            <div>
              <label className="label" htmlFor="f-start">
                Beginn
              </label>
              <input id="f-start" type="time" className="field tnum" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} aria-invalid={!!errors.startTime} />
              {err('startTime')}
            </div>
            <div>
              <label className="label" htmlFor="f-end">
                Ende <span className="font-normal">(optional)</span>
              </label>
              <input id="f-end" type="time" className="field tnum" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} aria-invalid={!!errors.endTime} />
              {err('endTime')}
            </div>
          </>
        )}
      </div>

      <fieldset>
        <legend className="label">Kategorie</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('category', c)}
              aria-pressed={v.category === c}
              className={`${catClass(c)} inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                v.category === c ? 'border-cat bg-cat/10 font-medium' : 'border-line text-muted hover:text-ink'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-cat" aria-hidden="true" />
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </fieldset>

      {!isNote && (
        <fieldset>
          <legend className="label">Priorität</legend>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p ?? 'none'}
                type="button"
                onClick={() => set('priority', p)}
                aria-pressed={v.priority === p}
                className={`min-h-10 rounded-full border px-3 text-sm transition-colors ${
                  v.priority === p ? 'border-accent bg-accent/10 font-medium text-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {p ? PRIORITY_LABEL[p] : 'Keine'}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="f-body">
          {isNote ? 'Notiz' : 'Notizen'} {!isNote && <span className="font-normal">(optional)</span>}
        </label>
        <textarea
          id="f-body"
          rows={isNote ? 6 : 3}
          className="field py-2 leading-relaxed"
          value={v.body}
          maxLength={5000}
          onChange={(e) => set('body', e.target.value)}
          placeholder={isNote ? 'Gedanken, Lernstoff, Erinnerungen …' : 'Ort, Vorbereitung, Links …'}
        />
        {err('body')}
      </div>

      {failure && (
        <p className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {failure}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Speichert …' : editing ? 'Änderungen speichern' : isNote ? 'Notiz speichern' : 'Termin speichern'}
        </button>
      </div>
    </form>
  )
}
