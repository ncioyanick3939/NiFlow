import { inputToRow, rowToEvent, validateEntry } from '../domain/entries'
import type { EntryInput, EntryRow } from '../domain/entries'
import type { CalendarEvent } from '../domain/types'
import { supabase } from '../lib/supabase'

// Zugriff auf die Tabelle "entries". Die Zugriffsregeln (RLS) in der Datenbank sorgen dafür,
// dass jeder nur seine eigenen Zeilen sieht und ändert.

const COLUMNS = 'id,type,title,body,category,all_day,start_at,end_at,priority,exam_id,task_id'

function describe(error: { message: string; code?: string }): Error {
  if (error.code === '42501') return new Error('Keine Berechtigung. Bitte neu anmelden.')
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new Error('Die Datenbank-Tabelle für Einträge fehlt noch. Bitte die Migration einspielen.')
  }
  return new Error(`Datenbankfehler: ${error.message}`)
}

export async function listEntries(from: Date, to: Date): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('entries')
    .select(COLUMNS)
    .lt('start_at', to.toISOString())
    .or(`end_at.gt.${from.toISOString()},start_at.gte.${from.toISOString()}`)
    .order('start_at', { ascending: true })
    .limit(2000)
  if (error) throw describe(error)
  return (data as EntryRow[]).map(rowToEvent)
}

function checked(input: EntryInput) {
  const errors = validateEntry(input)
  if (errors) throw new Error(Object.values(errors)[0])
  return inputToRow(input)
}

export async function createEntry(input: EntryInput): Promise<void> {
  const { error } = await supabase.from('entries').insert(checked(input))
  if (error) throw describe(error)
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const { data, error } = await supabase
    .from('entries')
    .update({ ...checked(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw describe(error)
  if (!data || data.length === 0) throw new Error('Eintrag nicht gefunden. Er wurde vielleicht schon gelöscht.')
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw describe(error)
}
