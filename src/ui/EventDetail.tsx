import { useState } from 'react'
import { addDays, formatDateLong, formatWeekday } from '../domain/dateUtils'
import { eventToInput, toDateInput } from '../domain/entries'
import type { EntryInput } from '../domain/entries'
import { CATEGORY_LABEL, PRIORITY_LABEL, SOURCE_LABEL } from '../domain/types'
import type { CalendarEvent } from '../domain/types'
import Icon, { sportIcon } from './icons'
import { catClass, formatEventTime, kindLabel } from './kit'

interface Props {
  event: CalendarEvent
  readOnly: boolean
  onEdit: (e: CalendarEvent) => void
  onMove: (e: CalendarEvent, input: EntryInput) => Promise<void>
  onDelete: (e: CalendarEvent) => Promise<void>
  onAddNote: (date: Date, title: string) => void
}

export default function EventDetail({ event: e, readOnly, onEdit, onMove, onDelete, onAddNote }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const own = e.source === 'own'
  const kind = kindLabel(e) ?? 'Termin'

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try {
      await fn()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.')
      setBusy(false)
    }
  }

  const moveTomorrow = () => run(() => onMove(e, { ...eventToInput(e), date: toDateInput(addDays(e.start, 1)) }))

  return (
    <div className={`${catClass(e.category)} space-y-5`}>
      <div className="flex gap-3">
        <span className="w-1 shrink-0 rounded-full bg-cat" aria-hidden="true" />
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            {e.source === 'intervals' && <Icon name={sportIcon(e.sport)} size={14} />}
            {kind} · {CATEGORY_LABEL[e.category]}
          </p>
          <h3 className="mt-1 break-words text-xl font-semibold leading-snug">{e.title}</h3>
          <p className="tnum mt-1 text-sm text-muted">
            {formatWeekday(e.start)}, {formatDateLong(e.start)}
            {e.kind !== 'note' && <> · {formatEventTime(e)}</>}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Quelle</dt>
        <dd>{own ? 'Eigener Eintrag' : e.source === 'test' ? 'Demo (erfunden)' : `${SOURCE_LABEL[e.source]} · importiert`}</dd>
        {e.priority && (
          <>
            <dt className="text-muted">Priorität</dt>
            <dd>{PRIORITY_LABEL[e.priority]}</dd>
          </>
        )}
        {e.sport && (
          <>
            <dt className="text-muted">Sportart</dt>
            <dd>{e.sport}</dd>
          </>
        )}
        {e.intensity === 'high' && (
          <>
            <dt className="text-muted">Belastung</dt>
            <dd>Intensiv (danach eine Stunde Erholung eingeplant)</dd>
          </>
        )}
        {!e.end && !e.allDay && e.kind !== 'note' && (
          <>
            <dt className="text-muted">Dauer</dt>
            <dd>Unbekannt</dd>
          </>
        )}
      </dl>

      {e.description && (
        <div className="whitespace-pre-wrap break-words rounded-md bg-surface2 px-4 py-3 text-sm leading-relaxed">{e.description}</div>
      )}

      {!own && (
        <p className="text-xs text-muted">
          {e.source === 'test'
            ? 'Erfundener Demo-Eintrag.'
            : `Dieser Eintrag kommt aus ${SOURCE_LABEL[e.source]} und wird dort bearbeitet. NiFlow liest ihn nur.`}
        </p>
      )}

      {failure && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {failure}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {own && !confirm && (
            <>
              <button type="button" className="btn-primary" onClick={() => onEdit(e)} disabled={busy}>
                <Icon name="pencil" size={16} /> Bearbeiten
              </button>
              <button type="button" className="btn-outline" onClick={() => void moveTomorrow()} disabled={busy}>
                <Icon name="arrowRight" size={16} /> Auf morgen
              </button>
            </>
          )}
          {e.kind !== 'note' && !confirm && (
            <button type="button" className="btn-outline" onClick={() => onAddNote(e.start, e.title)} disabled={busy}>
              <Icon name="note" size={16} /> Notiz dazu
            </button>
          )}
          {own && !confirm && (
            <button type="button" className="btn-ghost ml-auto text-danger" onClick={() => setConfirm(true)} disabled={busy}>
              <Icon name="trash" size={16} /> Löschen
            </button>
          )}
          {own && confirm && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <p className="mr-auto text-sm">«{e.title}» endgültig löschen?</p>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>
                Behalten
              </button>
              <button type="button" className="btn bg-danger text-white hover:bg-danger/90" onClick={() => void run(() => onDelete(e))} disabled={busy}>
                {busy ? 'Löscht …' : 'Löschen'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
