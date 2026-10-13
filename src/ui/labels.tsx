import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { listLabels, LabelsMissing } from '../data/labels'
import { DEMO_LABELS } from '../data/demoPlanner'
import { sortLabels } from '../domain/labels'
import type { Label } from '../domain/labels'
import type { CalendarEvent, Category } from '../domain/types'
import { CATEGORY_LABEL } from '../domain/types'

const CATEGORIES: Category[] = ['training', 'work', 'study', 'private']

// Eigene Kategorien in der Oberfläche: laden, nachschlagen, Farbklassen.

export interface LabelsState {
  labels: Label[]
  byId: Map<string, Label>
  /** Tabelle fehlt noch (Migration nicht eingespielt). */
  missing: boolean
  reload: () => Promise<void>
}

const empty: LabelsState = { labels: [], byId: new Map(), missing: false, reload: async () => {} }
export const LabelsContext = createContext<LabelsState>(empty)
export const useLabelsCtx = () => useContext(LabelsContext)

export function useLabelsData(mode: 'live' | 'demo' | 'off', ready: boolean): LabelsState {
  const [labels, setLabels] = useState<Label[]>([])
  const [missing, setMissing] = useState(false)
  const reload = useCallback(async () => {
    if (mode === 'off') return setLabels([])
    if (mode === 'demo') return setLabels(DEMO_LABELS)
    try {
      setLabels(sortLabels(await listLabels()))
      setMissing(false)
    } catch (err) {
      // Ohne Tabelle läuft die App einfach ohne eigene Kategorien weiter
      if (err instanceof LabelsMissing) setMissing(true)
      setLabels([])
    }
  }, [mode])
  useEffect(() => {
    if (ready) void reload()
  }, [reload, ready])
  return { labels, byId: new Map(labels.map((l) => [l.id, l])), missing, reload }
}

/** Name und Farbe der eigenen Kategorie an Termine hängen (für Anzeige und Farbe). */
export function withLabels(events: CalendarEvent[], byId: Map<string, Label>): CalendarEvent[] {
  if (byId.size === 0) return events
  return events.map((e) => {
    const l = e.labelId ? byId.get(e.labelId) : undefined
    return l ? { ...e, labelName: l.name, labelColor: l.color } : e
  })
}

/** CSS-Klassen für die Farbe: Grundbereich, darüber die eigene Farbe. */
export const colorClass = (category: Category, label?: Label | null) => `cat-${category}${label ? ` col-${label.color}` : ''}`
export const evClass = (e: CalendarEvent) => `cat-${e.category}${e.labelColor ? ` col-${e.labelColor}` : ''}`

/** Anzeigename: eigene Kategorie, sonst Grundbereich. */
export const categoryName = (category: Category, label?: Label | null) => label?.name ?? CATEGORY_LABEL[category]

/**
 * Kategorie-Auswahl für Formulare: die vier Grundbereiche und danach die eigenen Kategorien.
 * Wählt man eine eigene, wird ihr Grundbereich mitgesetzt.
 */
export function CategoryChips({
  category,
  labelId,
  onChange,
  small = false,
}: {
  category: Category
  labelId: string | null | undefined
  onChange: (category: Category, labelId: string | null) => void
  small?: boolean
}) {
  const { labels, byId } = useLabelsCtx()
  const current = labelId ? byId.get(labelId) : undefined
  const chip = `inline-flex items-center gap-2 rounded-full border px-3 transition-colors ${small ? 'min-h-9 text-xs' : 'min-h-10 text-sm'}`
  const on = 'border-cat bg-cat/10 font-medium text-ink'
  const off = 'border-line text-muted hover:text-ink'
  return (
    <fieldset>
      <legend className="label">Kategorie</legend>
      <div className={`flex flex-wrap ${small ? 'gap-1.5' : 'gap-2'}`}>
        {CATEGORIES.map((c) => {
          const active = !current && category === c
          return (
            <button key={c} type="button" onClick={() => onChange(c, null)} aria-pressed={active} className={`cat-${c} ${chip} ${active ? on : off}`}>
              <span className="h-2 w-2 rounded-full bg-cat" aria-hidden="true" />
              {CATEGORY_LABEL[c]}
            </button>
          )
        })}
        {labels.map((l) => {
          const active = current?.id === l.id
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.category, l.id)}
              aria-pressed={active}
              title={`Eigene Kategorie, zählt zu ${CATEGORY_LABEL[l.category]}`}
              className={`${colorClass(l.category, l)} ${chip} border-dashed ${active ? on + ' border-solid' : off}`}
            >
              <span className="h-2 w-2 rotate-45 rounded-[2px] bg-cat" aria-hidden="true" />
              {l.name}
            </button>
          )
        })}
      </div>
      {/* Gespeicherte Kategorie, die inzwischen gelöscht wurde */}
      {labelId && !current && labels.length > 0 && <p className="mt-1.5 text-xs text-muted">Die eigene Kategorie gibt es nicht mehr.</p>}
    </fieldset>
  )
}
