import { useCallback, useRef, useState } from 'react'
import { askAssistant } from '../../data/assistant'
import type { AssistantTurn } from '../../data/assistant'
import { buildAiContext, describeProposal, parseProposals } from '../../domain/aiPlan'
import type { Proposal } from '../../domain/aiPlan'
import type { Exam } from '../../domain/exams'
import type { Task } from '../../domain/tasks'
import type { CalendarEvent } from '../../domain/types'

export type ProposalStatus = 'pending' | 'applied' | 'dismissed'
export interface ProposalItem {
  proposal: Proposal
  status: ProposalStatus
  selected: boolean
}
export interface ChatMsg {
  id: number
  role: 'user' | 'assistant'
  text: string
  error?: boolean
  items?: ProposalItem[]
  /** Anzahl Vorschläge, die die KI gemacht hat, die aber ungültig waren. */
  dropped?: number
}

interface Data {
  events: CalendarEvent[]
  tasks: Task[]
  exams: Exam[]
  now: Date
}

const STATUS_WORD: Record<ProposalStatus, string> = { pending: 'offen', applied: 'übernommen', dismissed: 'abgelehnt' }

/** Gespräch mit dem KI-Planer. Bleibt erhalten, solange die App offen ist (auch wenn das Fenster zu ist). */
export function useAssistant(data: Data) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [busy, setBusy] = useState(false)
  const latest = useRef(data)
  latest.current = data
  const msgRef = useRef(messages)
  msgRef.current = messages
  const nextId = useRef(1)
  const abort = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    const clean = text.trim().slice(0, 1500)
    if (!clean || busy) return
    const history: AssistantTurn[] = msgRef.current
      .filter((m) => !m.error)
      .map((m) => {
        const items = m.items?.length ? `\n[Vorschläge: ${m.items.map((i) => `${describeProposal(i.proposal)} (${STATUS_WORD[i.status]})`).join('; ')}]` : ''
        return { role: m.role, content: m.text + items }
      })
    history.push({ role: 'user', content: clean })
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: clean }])
    setBusy(true)
    abort.current = new AbortController()
    try {
      const d = latest.current
      const ctx = buildAiContext({ ...d, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      const answer = await askAssistant(history.slice(-14), ctx.text, abort.current.signal)
      const parsed = parseProposals(answer.proposals, ctx, d.tasks, d.events, d.now)
      const items: ProposalItem[] = parsed.proposals.map((proposal) => ({ proposal, status: 'pending', selected: !(proposal.kind === 'event' && proposal.warning) }))
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: 'assistant',
          text: answer.reply || (items.length ? 'Hier sind meine Vorschläge.' : 'Dazu habe ich nichts vorzuschlagen.'),
          items,
          dropped: parsed.dropped,
        },
      ])
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setMessages((m) => [...m, { id: nextId.current++, role: 'assistant', text: err instanceof Error ? err.message : 'Unbekannter Fehler.', error: true }])
    } finally {
      setBusy(false)
    }
  }, [busy])

  const toggle = useCallback((msgId: number, index: number) => {
    setMessages((all) =>
      all.map((m) =>
        m.id !== msgId || !m.items ? m : { ...m, items: m.items.map((it, i) => (i === index && it.status === 'pending' ? { ...it, selected: !it.selected } : it)) },
      ),
    )
  }, [])

  const settle = useCallback((msgId: number, status: ProposalStatus, only?: Set<number>) => {
    setMessages((all) =>
      all.map((m) =>
        m.id !== msgId || !m.items
          ? m
          : { ...m, items: m.items.map((it, i) => (it.status === 'pending' && (only ? only.has(i) : true) ? { ...it, status } : it)) },
      ),
    )
  }, [])

  const clear = useCallback(() => {
    abort.current?.abort()
    setBusy(false)
    setMessages([])
  }, [])

  return { messages, busy, send, toggle, settle, clear }
}
