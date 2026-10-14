import { useEffect, useRef, useState } from 'react'
import { formatDayMonth, formatWeekdayShort } from '../../domain/dateUtils'
import { parseDateInput } from '../../domain/entries'
import type { Proposal } from '../../domain/aiPlan'
import { categoryIcon } from '../icons'
import Icon from '../icons'
import type { WeatherPlace as Place } from '../../domain/weather'
import WeatherPlace from '../WeatherPlace'
import RichText from './RichText'
import type { ChatMsg, useAssistant } from './useAssistant'

type Chat = ReturnType<typeof useAssistant>

interface Props {
  chat: Chat
  suggestions: string[]
  /** Einwilligung zur Weitergabe an die KI (Apple 5.1.2(i)). Ohne sie wird nichts gesendet. */
  consent: boolean
  onConsent: () => void
  /** Ort für das Wetter (nur auf diesem Gerät) */
  place: Place | null
  onPlace: (p: Place | null) => void
  /** Frage, die beim Öffnen einmal automatisch gestellt wird (z. B. aus einer Prüfung heraus) */
  autoPrompt?: string
  /** Legt die gewählten Vorschläge an und meldet pro Vorschlag, ob es geklappt hat. */
  onApply: (list: Proposal[]) => Promise<{ ok: boolean[]; error?: string }>
}

const dayText = (iso: string): string => {
  const d = parseDateInput(iso)
  return d ? `${formatWeekdayShort(d)} ${formatDayMonth(d)}` : iso
}

function describe(p: Proposal): { icon: Parameters<typeof Icon>[0]['name']; title: string; when: string; tag: string } {
  if (p.kind === 'event') {
    return { icon: categoryIcon(p.input.category), title: p.input.title, when: `${dayText(p.input.date)} · ${p.input.startTime}–${p.input.endTime}`, tag: 'Termin' }
  }
  if (p.kind === 'task') {
    return {
      icon: 'tasks',
      title: p.input.title,
      when: p.input.dueDate ? `bis ${dayText(p.input.dueDate)}${p.input.dueTime ? ' · ' + p.input.dueTime : ''}` : 'Inbox, ohne Datum',
      tag: 'Aufgabe',
    }
  }
  const from = p.task.dueDate ? dayText(p.task.dueDate) : 'Inbox'
  return { icon: 'arrowRight', title: p.task.title, when: `${from} → ${dayText(p.input.dueDate!)}${p.input.dueTime ? ' · ' + p.input.dueTime : ''}`, tag: 'Verschieben' }
}

function Bubble({ m, onToggle, onApply, onDismiss }: { m: ChatMsg; onToggle: (i: number) => void; onApply: () => Promise<void>; onDismiss: () => void }) {
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const items = m.items ?? []
  const pending = items.filter((i) => i.status === 'pending')
  const chosen = pending.filter((i) => i.selected)

  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] font-medium text-accentink">{m.text}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className={`max-w-[94%] rounded-3xl rounded-bl-lg px-4 py-3 text-[15px] leading-relaxed ${m.error ? 'bg-danger/10 text-danger' : 'bg-surface2'}`}>
        {m.error ? <p className="whitespace-pre-wrap">{m.text}</p> : <RichText text={m.text} />}
      </div>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const d = describe(it.proposal)
            const warning = it.proposal.kind === 'event' ? it.proposal.warning : undefined
            const done = it.status !== 'pending'
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={done || working}
                  onClick={() => onToggle(i)}
                  aria-pressed={it.selected && !done}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                    done ? 'border-transparent bg-surface2 opacity-60' : it.selected ? 'border-accent/50 bg-accent/[0.07]' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      it.status === 'applied' ? 'border-accent bg-accent text-accentink' : it.selected && !done ? 'border-accent bg-accent text-accentink' : 'border-line text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    {it.status === 'dismissed' ? <Icon name="x" size={13} /> : <Icon name="check" size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                      <Icon name={d.icon} size={12} />
                      {d.tag}
                      {it.status === 'applied' && <span className="text-accent">· übernommen</span>}
                      {it.status === 'dismissed' && <span>· verworfen</span>}
                    </span>
                    <span className="mt-0.5 block text-[15px] font-bold leading-snug">{d.title}</span>
                    <span className="tnum block text-sm font-medium text-muted">{d.when}</span>
                    {warning && <span className="mt-1 block text-xs font-semibold text-danger">{warning}</span>}
                    {it.proposal.reason && <span className="mt-1 block text-xs text-muted">{it.proposal.reason}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {(m.dropped ?? 0) > 0 && <p className="text-xs text-muted">{m.dropped} ungültige(r) Vorschlag/Vorschläge wurde(n) ausgeblendet.</p>}
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={chosen.length === 0 || working}
            onClick={async () => {
              setWorking(true)
              setFailed(null)
              try {
                await onApply()
              } catch (err) {
                setFailed(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
              } finally {
                setWorking(false)
              }
            }}
            className="btn-primary min-h-10"
          >
            {working ? 'Wird gespeichert …' : chosen.length === pending.length ? `Alle übernehmen (${chosen.length})` : `Auswahl übernehmen (${chosen.length})`}
          </button>
          <button type="button" disabled={working} onClick={onDismiss} className="btn-ghost min-h-10 text-muted">
            Verwerfen
          </button>
        </div>
      )}
      {failed && <p role="alert" className="text-sm font-medium text-danger">{failed}</p>}
    </div>
  )
}

export default function AssistantPanel({ chat, suggestions, consent, onConsent, onApply, place, onPlace, autoPrompt }: Props) {
  const { messages, busy, send, toggle, settle, clear } = chat
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const lastMsg = useRef<HTMLDivElement>(null)

  // Neue Antwort: ab ihrem Anfang lesen. Eigene Frage und Wartezustand: ans Ende scrollen.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && !busy) lastMsg.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    else end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, busy])

  const autoSent = useRef(false)
  useEffect(() => {
    if (!consent || !autoPrompt || autoSent.current || busy) return
    autoSent.current = true
    void send(autoPrompt)
  }, [consent, autoPrompt, busy, send])

  const submit = (value: string) => {
    if (!value.trim() || busy) return
    setText('')
    void send(value)
  }

  if (!consent) return <ConsentCard onConsent={onConsent} />

  return (
    <div className="flex flex-col">
      {/* data-autofocus: Fokus nicht ins Textfeld, sonst springt auf dem Handy sofort die Tastatur auf */}
      <div tabIndex={-1} data-autofocus className="space-y-4 outline-none">
        {messages.length === 0 && (
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3">
              <span className="dot-cat cat-study h-12 w-12 shrink-0">
                <Icon name="sparkle" size={22} />
              </span>
              <div>
                <p className="text-[17px] font-extrabold leading-tight">Dein Planungs-Assistent</p>
                <p className="mt-1 text-sm text-muted">Frag nach einem Lernplan, einem Tagesplan oder danach, was du verschieben sollst. Du entscheidest, was davon in deinen Plan kommt.</p>
                <p className="mt-2 text-xs text-muted">Die KI sieht Titel, Zeiten und Prüfungsthemen der nächsten 14 Tage, keine Notizen. Nichts wird ohne dein OK geändert.</p>
              </div>
            </div>
            {!place && (
              <div className="space-y-2 rounded-2xl border border-line p-3">
                <p className="text-sm font-semibold">Wetter einbeziehen</p>
                <p className="text-xs text-muted">Wähle deinen Ort, dann kann der Assistent nach dem Wetter gefragt werden und Velo und Laufen auf trockene Tage legen.</p>
                <WeatherPlace place={place} onChange={onPlace} compact />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => submit(s)} className="rounded-full bg-accent/[0.12] px-3.5 py-2 text-left text-sm font-semibold text-accent transition hover:bg-accent/20 active:scale-[0.98]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, mi) => (
          <div key={m.id} ref={mi === messages.length - 1 ? lastMsg : undefined} className="scroll-mt-20">
          <Bubble
            m={m}
            onToggle={(i) => toggle(m.id, i)}
            onDismiss={() => settle(m.id, 'dismissed')}
            onApply={async () => {
              const idx = new Set<number>()
              const list: Proposal[] = []
              m.items?.forEach((it, i) => {
                if (it.status === 'pending' && it.selected) {
                  idx.add(i)
                  list.push(it.proposal)
                }
              })
              const result = await onApply(list)
              const order = [...idx]
              const done = new Set(order.filter((_, k) => result.ok[k]))
              settle(m.id, 'applied', done)
              if (result.error) throw new Error(result.error)
              // Nicht gewählte, offene Vorschläge gelten als abgelehnt
              settle(m.id, 'dismissed')
            }}
          />
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted" role="status">
            <Icon name="sparkle" size={16} className="anim-pulse text-accent" />
            Ich schaue mir deinen Plan an …
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 bg-surface px-6 pb-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(text)
          }}
          className="flex items-end gap-2"
        >
          <label className="sr-only" htmlFor="ai-input">
            Nachricht an den Planungs-Assistenten
          </label>
          <textarea
            id="ai-input"
            rows={1}
            value={text}
            maxLength={1500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                e.preventDefault()
                submit(text)
              }
            }}
            placeholder="Frag zu deinem Plan …"
            className="field max-h-32 min-h-12 flex-1 resize-none rounded-3xl py-3"
          />
          <button type="submit" disabled={!text.trim() || busy} className="btn-primary h-12 w-12 shrink-0 px-0" aria-label="Senden">
            <Icon name="arrowUp" size={20} />
          </button>
        </form>
        {messages.length > 0 && (
          <div className="mt-1 flex justify-end">
            <button type="button" onClick={clear} className="min-h-8 px-1 text-xs font-semibold text-accent">
              Neues Gespräch
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Zustimmungsfenster vor der ersten KI-Anfrage: was geht an wen, und dass es freiwillig ist. */
function ConsentCard({ onConsent }: { onConsent: () => void }) {
  return (
    <div className="space-y-5 py-2" data-autofocus tabIndex={-1}>
      <div className="flex items-start gap-3">
        <span className="dot-cat cat-study h-12 w-12 shrink-0">
          <Icon name="sparkle" size={22} />
        </span>
        <div>
          <p className="text-[17px] font-extrabold leading-tight">Bevor du den Assistenten nutzt</p>
          <p className="mt-1 text-sm text-muted">Der Planungs-Assistent ist freiwillig. Alles andere in NiFlow funktioniert auch ohne ihn.</p>
        </div>
      </div>
      <div className="space-y-3 rounded-3xl bg-surface2 p-4 text-sm leading-relaxed">
        <p>
          <span className="font-bold">Was gesendet wird:</span> Bei jeder Frage sendet NiFlow deine Nachricht und eine Übersicht der nächsten 14 Tage an die KI: Titel, Zeiten und
          Kategorien deiner Termine und Aufgaben sowie Prüfungsthemen. Wenn du einen Wetter-Ort gewählt hast, kommt die Wettervorhersage dazu, aber ohne den Ortsnamen. Notizen und Beschreibungen werden nicht gesendet.
        </p>
        <p>
          <span className="font-bold">An wen:</span> Die Übersicht geht über unseren Server an den KI-Anbieter Anthropic (USA), der daraus die Antwort erstellt.
        </p>
        <p>
          <span className="font-bold">Du behältst die Kontrolle:</span> Nichts wird ohne dein OK in deinen Plan übernommen. Die Einwilligung kannst du jederzeit in den Einstellungen widerrufen.
        </p>
      </div>
      <p className="text-xs text-muted">
        Details stehen in der{' '}
        <a href="./datenschutz.html" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
          Datenschutzerklärung
        </a>
        .
      </p>
      <button type="button" onClick={onConsent} className="btn-primary min-h-12 w-full">
        Ich bin einverstanden
      </button>
    </div>
  )
}
