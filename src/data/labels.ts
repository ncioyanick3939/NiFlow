import { rowToLabel, validateLabel } from '../domain/labels'
import type { Label, LabelColor, LabelRow } from '../domain/labels'
import type { Category } from '../domain/types'
import { supabase } from '../lib/supabase'

// Eigene Kategorien (Tabelle "labels"). RLS begrenzt auf die eigenen Zeilen.
// Solange die Migration nicht eingespielt ist, läuft die App ohne eigene Kategorien weiter.

type PgError = { message: string; code?: string }

/** Wird gesetzt, sobald die Datenbank meldet, dass es die Spalte label_id (noch) nicht gibt. */
export let labelColumnMissing = false

export const isMissingLabel = (e: PgError | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || e.code === '42P01' || e.code === 'PGRST205') && /label/i.test(e.message)

/** Entfernt label_id, solange die Spalte fehlt. */
export function stripLabel<T extends object>(row: T): T {
  if (!labelColumnMissing || !('label_id' in row)) return row
  const { label_id: _drop, ...rest } = row as T & { label_id?: unknown }
  return rest as T
}

/** Führt eine Abfrage aus; fehlt die Spalte label_id, ein zweites Mal ohne sie. */
export async function withLabelFallback<R extends { error: PgError | null }>(run: () => PromiseLike<R>): Promise<R> {
  const first = await run()
  if (!labelColumnMissing && isMissingLabel(first.error)) {
    labelColumnMissing = true
    return run()
  }
  return first
}

export class LabelsMissing extends Error {
  constructor() {
    super('Eigene Kategorien brauchen noch die Datenbank-Änderung (npx supabase db push).')
  }
}

function describe(error: PgError): Error {
  if (error.code === '42P01' || error.code === 'PGRST205') return new LabelsMissing()
  if (error.code === '42501') return new Error('Keine Berechtigung. Bitte neu anmelden.')
  return new Error(`Datenbankfehler: ${error.message}`)
}

export async function listLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('id,name,color,category,sort').order('sort').limit(200)
  if (error) throw describe(error)
  return (data as LabelRow[]).map(rowToLabel)
}

export async function createLabel(v: { name: string; color: LabelColor; category: Category }, existing: Label[]): Promise<void> {
  const msg = validateLabel(v.name, existing)
  if (msg) throw new Error(msg)
  const sort = existing.reduce((m, l) => Math.max(m, l.sort), -1) + 1
  const { error } = await supabase.from('labels').insert({ name: v.name.trim(), color: v.color, category: v.category, sort })
  if (error) throw describe(error)
}

export async function updateLabel(id: string, v: { name: string; color: LabelColor; category: Category }, existing: Label[]): Promise<void> {
  const msg = validateLabel(v.name, existing, id)
  if (msg) throw new Error(msg)
  const { data, error } = await supabase.from('labels').update({ name: v.name.trim(), color: v.color, category: v.category }).eq('id', id).select('id')
  if (error) throw describe(error)
  if (!data?.length) throw new Error('Kategorie nicht gefunden.')
}

/** Löschen: Einträge und Aufgaben behalten ihren Grundbereich (label_id wird leer). */
export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase.from('labels').delete().eq('id', id)
  if (error) throw describe(error)
}
