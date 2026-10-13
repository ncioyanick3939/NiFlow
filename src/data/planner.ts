import { examToRow, rowToExam, validateExam } from '../domain/exams'
import type { Exam, ExamInput, ExamRow } from '../domain/exams'
import { rowToTask, taskToRow, validateTask } from '../domain/tasks'
import type { Task, TaskInput, TaskRow, TaskStatus } from '../domain/tasks'
import { supabase } from '../lib/supabase'

// Zugriff auf Aufgaben und Prüfungen. RLS in der Datenbank begrenzt auf die eigenen Zeilen.

const TASK_COLS = 'id,title,description,due_date,due_time,priority,status,category,exam_id,estimate_minutes,reminder_minutes,completed_at,created_at'
const EXAM_COLS = 'id,title,subject,start_at,end_at,location,format,description,topics,notes,priority,prep_status'

function describe(error: { message: string; code?: string }): Error {
  if (error.code === '42501') return new Error('Keine Berechtigung. Bitte neu anmelden.')
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new Error('Die Tabellen für Aufgaben und Prüfungen fehlen noch. Bitte die Migration einspielen (npx supabase db push).')
  }
  return new Error(`Datenbankfehler: ${error.message}`)
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select(TASK_COLS).order('created_at').limit(5000)
  if (error) throw describe(error)
  return (data as TaskRow[]).map(rowToTask)
}

export async function listExams(): Promise<Exam[]> {
  const { data, error } = await supabase.from('exams').select(EXAM_COLS).order('start_at').limit(1000)
  if (error) throw describe(error)
  return (data as ExamRow[]).map(rowToExam)
}

function checkedTask(t: TaskInput) {
  const e = validateTask(t)
  if (e) throw new Error(Object.values(e)[0])
}

export async function createTask(t: TaskInput): Promise<void> {
  checkedTask(t)
  const { error } = await supabase.from('tasks').insert(taskToRow(t))
  if (error) throw describe(error)
}

export async function createTasks(list: TaskInput[]): Promise<void> {
  list.forEach(checkedTask)
  const { error } = await supabase.from('tasks').insert(list.map((t) => taskToRow(t)))
  if (error) throw describe(error)
}

export async function updateTask(id: string, t: TaskInput, prevStatus: TaskStatus): Promise<void> {
  checkedTask(t)
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...taskToRow(t, prevStatus), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw describe(error)
  if (!data?.length) throw new Error('Aufgabe nicht gefunden. Sie wurde vielleicht schon gelöscht.')
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw describe(error)
}

function checkedExam(v: ExamInput) {
  const e = validateExam(v)
  if (e) throw new Error(Object.values(e)[0])
  return examToRow(v)
}

export async function createExam(v: ExamInput): Promise<string> {
  const { data, error } = await supabase.from('exams').insert(checkedExam(v)).select('id').single()
  if (error) throw describe(error)
  return (data as { id: string }).id
}

export async function updateExam(id: string, v: ExamInput): Promise<void> {
  const { data, error } = await supabase
    .from('exams')
    .update({ ...checkedExam(v), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw describe(error)
  if (!data?.length) throw new Error('Prüfung nicht gefunden.')
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', id)
  if (error) throw describe(error)
}
