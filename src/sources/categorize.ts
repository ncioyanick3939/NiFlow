import type { Category, Intensity } from '../domain/types'

// Ordnet einen Termin anhand von Stichwörtern im Titel einer Kategorie zu.
// Reihenfolge zählt: Der erste Treffer gewinnt. Alles ohne Treffer ist "Privat".
// Diese Regeln sind eine Annahme und werden später in den Einstellungen anpassbar.
const RULES: { category: Category; words: string[] }[] = [
  {
    category: 'training',
    words: ['schwimm', 'swim', 'lauf', 'run', 'rad', 'bike', 'velo', 'training', 'triathlon', 'intervall', 'koppel', 'krafttraining', 'yoga', 'wettkampf'],
  },
  {
    category: 'study',
    words: ['vorlesung', 'übung', 'uebung', 'prüfung', 'pruefung', 'klausur', 'moodle', 'bfh', 'seminar', 'modul', 'studium', 'lernen', 'abgabe', 'tutorium', 'projekt'],
  },
  {
    category: 'work',
    words: ['arbeit', 'work', 'meeting', 'sitzung', 'kunde', 'büro', 'buero', 'schicht', 'call'],
  },
]

const INTENSE = ['intervall', 'tempo', 'schwelle', 'wettkampf', 'koppel', 'vo2', 'race']

export function categorize(title: string): Category {
  const t = title.toLowerCase()
  for (const rule of RULES) if (rule.words.some((w) => t.includes(w))) return rule.category
  return 'private'
}

/** Nur für Training: intensive Einheiten erkennt man am Titel. Sonst unbekannt. */
export function guessIntensity(title: string, category: Category): Intensity | undefined {
  if (category !== 'training') return undefined
  const t = title.toLowerCase()
  return INTENSE.some((w) => t.includes(w)) ? 'high' : undefined
}
