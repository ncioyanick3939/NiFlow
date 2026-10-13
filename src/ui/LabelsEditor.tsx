import { useState } from 'react'
import { createLabel, deleteLabel, updateLabel } from '../data/labels'
import { LABEL_COLORS, LABEL_COLOR_NAME, NAME_MAX, suggestColor } from '../domain/labels'
import type { Label, LabelColor } from '../domain/labels'
import { CATEGORY_LABEL } from '../domain/types'
import type { Category } from '../domain/types'
import Icon from './icons'
import { colorClass, useLabelsCtx } from './labels'

const CATS: Category[] = ['study', 'work', 'training', 'private']

interface Draft {
  name: string
  color: LabelColor
  category: Category
}

/** Eigene Kategorien verwalten (Einstellungen). */
export default function LabelsEditor({ readOnly, onChanged }: { readOnly: boolean; onChanged: (deleted: boolean) => Promise<void> }) {
  const { labels, missing } = useLabelsCtx()
  const [draft, setDraft] = useState<Draft>(() => ({ name: '', color: suggestColor(labels), category: 'study' }))
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const run = async (fn: () => Promise<void>, ok: string, deleted = false) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      await onChanged(deleted)
      setMsg({ kind: 'ok', text: ok })
      return true
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Nicht möglich.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  if (missing) {
    return (
      <p className="text-sm text-muted">
        Für eigene Kategorien fehlt noch die Datenbank-Änderung. Im Terminal: <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">npx supabase db push</code>, danach die Seite neu laden.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Eigene Namen und Farben, zum Beispiel für ein Modul oder ein Projekt. Jede gehört zu einem Grundbereich, damit die Wochenplanung weiter stimmt.
      </p>

      {labels.length > 0 && (
        <ul className="divide-y divide-line/70 rounded-xl border border-line/70">
          {labels.map((l) =>
            editing === l.id && edit ? (
              <li key={l.id} className="p-3">
                <LabelFields value={edit} onChange={setEdit} idPrefix={`e-${l.id}`} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary min-h-9 text-sm"
                    disabled={busy}
                    onClick={async () => {
                      if (await run(() => updateLabel(l.id, edit, labels), 'Gespeichert.')) setEditing(null)
                    }}
                  >
                    Speichern
                  </button>
                  <button type="button" className="btn-ghost min-h-9 text-sm" onClick={() => setEditing(null)}>
                    Abbrechen
                  </button>
                </div>
              </li>
            ) : (
              <li key={l.id} className={`${colorClass(l.category, l)} flex min-h-14 items-center gap-3 px-3 py-2`}>
                <span className="h-3.5 w-3.5 shrink-0 rotate-45 rounded-[3px] bg-cat" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.name}</span>
                  <span className="block text-xs text-muted">
                    {LABEL_COLOR_NAME[l.color]}, zählt zu {CATEGORY_LABEL[l.category]}
                  </span>
                </span>
                {!readOnly &&
                  (confirm === l.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost min-h-9 text-sm text-danger"
                        disabled={busy}
                        onClick={async () => {
                          await run(() => deleteLabel(l.id), `«${l.name}» gelöscht. Einträge behalten ihren Grundbereich.`, true)
                          setConfirm(null)
                        }}
                      >
                        Löschen
                      </button>
                      <button type="button" className="btn-ghost min-h-9 text-sm" onClick={() => setConfirm(null)}>
                        Nein
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface2 hover:text-ink"
                        aria-label={`${l.name} bearbeiten`}
                        onClick={() => {
                          setEditing(l.id)
                          setEdit({ name: l.name, color: l.color, category: l.category })
                          setConfirm(null)
                        }}
                      >
                        <Icon name="pencil" size={16} />
                      </button>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface2 hover:text-ink" aria-label={`${l.name} löschen`} onClick={() => setConfirm(l.id)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  ))}
              </li>
            ),
          )}
        </ul>
      )}

      {readOnly ? (
        <p className="text-xs text-muted">Im Demo-Modus nur zum Ansehen. Nach dem Anmelden legst du hier eigene an.</p>
      ) : (
        <form
          className="rounded-xl bg-surface2/60 p-4"
          onSubmit={async (ev) => {
            ev.preventDefault()
            const name = draft.name
            if (await run(() => createLabel(draft, labels), `«${name.trim()}» angelegt.`)) {
              setDraft({ name: '', color: suggestColor([...labels, { id: 'x', name, color: draft.color, category: draft.category, sort: 0 } as Label]), category: draft.category })
            }
          }}
        >
          <p className="mb-3 text-sm font-semibold">Neue Kategorie</p>
          <LabelFields value={draft} onChange={setDraft} idPrefix="new" />
          <button type="submit" className="btn-primary mt-4 min-h-10" disabled={busy || !draft.name.trim()}>
            <Icon name="plus" size={16} /> Hinzufügen
          </button>
        </form>
      )}

      {msg && (
        <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${msg.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

function LabelFields({ value, onChange, idPrefix }: { value: Draft; onChange: (d: Draft) => void; idPrefix: string }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          className="field"
          maxLength={NAME_MAX}
          value={value.name}
          placeholder="z. B. Statistik, Projekt Velo"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <fieldset>
        <legend className="label">Gehört zu</legend>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={value.category === c}
              onClick={() => onChange({ ...value, category: c })}
              className={`cat-${c} inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors ${
                value.category === c ? 'border-cat bg-cat/10 font-medium' : 'border-line text-muted hover:text-ink'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-cat" aria-hidden="true" />
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Farbe</legend>
        <div className="flex flex-wrap gap-2">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={value.color === c}
              aria-label={LABEL_COLOR_NAME[c]}
              title={LABEL_COLOR_NAME[c]}
              onClick={() => onChange({ ...value, color: c })}
              className={`col-${c} flex h-9 w-9 items-center justify-center rounded-full bg-cat text-white transition-transform hover:scale-110 ${
                value.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              {value.color === c && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
