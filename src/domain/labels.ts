// Eigene Kategorien: Name und Farbe, jeweils einem der vier Grundbereiche zugeordnet.
// Auswertungen (Wochenplanung usw.) zählen weiter nach Grundbereich.

import type { Category } from './types'

export const LABEL_COLORS = ['teal', 'sky', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'lime', 'green', 'slate', 'brown'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

export const LABEL_COLOR_NAME: Record<LabelColor, string> = {
  teal: 'Petrol',
  sky: 'Himmelblau',
  indigo: 'Indigo',
  violet: 'Violett',
  pink: 'Pink',
  red: 'Rot',
  orange: 'Orange',
  amber: 'Gold',
  lime: 'Limette',
  green: 'Grün',
  slate: 'Schiefer',
  brown: 'Braun',
}

export interface Label {
  id: string
  name: string
  color: LabelColor
  category: Category
  sort: number
}

export interface LabelRow {
  id: string
  name: string
  color: string
  category: Category
  sort: number
}

export const NAME_MAX = 40

export function rowToLabel(r: LabelRow): Label {
  return {
    id: r.id,
    name: r.name,
    color: (LABEL_COLORS as readonly string[]).includes(r.color) ? (r.color as LabelColor) : 'slate',
    category: r.category,
    sort: r.sort ?? 0,
  }
}

/** Fehlermeldung oder null. Namen müssen (ohne Gross/Klein) eindeutig sein. */
export function validateLabel(name: string, others: Label[], selfId?: string): string | null {
  const n = name.trim()
  if (!n) return 'Bitte einen Namen eingeben.'
  if (n.length > NAME_MAX) return `Höchstens ${NAME_MAX} Zeichen.`
  if (others.some((l) => l.id !== selfId && l.name.trim().toLocaleLowerCase('de-CH') === n.toLocaleLowerCase('de-CH'))) return 'Diesen Namen gibt es schon.'
  return null
}

/** Nächste noch nicht benutzte Farbe als Vorschlag. */
export function suggestColor(used: Label[]): LabelColor {
  return LABEL_COLORS.find((c) => !used.some((l) => l.color === c)) ?? LABEL_COLORS[used.length % LABEL_COLORS.length]
}

export const sortLabels = (ls: Label[]) => [...ls].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'de-CH'))
