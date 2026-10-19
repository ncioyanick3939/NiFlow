import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'

// Ruft die Supabase-Funktion "plan-assistant" auf. Der API-Schlüssel der KI liegt nur dort, nie in der App.

export class AssistantError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  unauthorized: 'Bitte neu anmelden.',
  not_configured: 'Der KI-Planer ist noch nicht eingerichtet: Auf dem Server fehlt der API-Schlüssel (Secret ANTHROPIC_API_KEY).',
  server_not_configured: 'Die Server-Funktion ist nicht fertig eingerichtet.',
  rate_limited: 'Das Tageslimit für KI-Anfragen ist erreicht. Morgen geht es weiter.',
  ai_busy: 'Die KI ist gerade ausgelastet. Bitte in einem Moment nochmals versuchen.',
  ai_key_invalid: 'Der API-Schlüssel der KI wird abgelehnt. Bitte den Schlüssel prüfen und neu als Secret setzen.',
  ai_credit: 'Das Guthaben bei Anthropic ist aufgebraucht oder fehlt. Bitte unter console.anthropic.com → Billing Guthaben aufladen.',
  ai_model: 'Die KI kennt das eingestellte Modell nicht. Bitte das Secret AI_MODEL prüfen oder entfernen.',
  ai_error: 'Die KI konnte gerade nicht antworten. Bitte nochmals versuchen.',
  bad_request: 'Die Anfrage war unvollständig.',
}

export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantAnswer {
  reply: string
  proposals: unknown[]
  /** «Vorgehen»: ein paar kurze Schritte */
  approach: unknown[]
}

export async function askAssistant(messages: AssistantTurn[], context: string, signal?: AbortSignal): Promise<AssistantAnswer> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new AssistantError('unauthorized', MESSAGES.unauthorized)
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/plan-assistant`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new AssistantError('network', 'Keine Verbindung zum Server.')
  }
  const body = (await res.json().catch(() => ({}))) as { reply?: unknown; proposals?: unknown; approach?: unknown; error?: unknown; detail?: unknown }
  if (!res.ok || body.error) {
    const code = String(body.error ?? res.status)
    if (res.status === 404 && !body.error) throw new AssistantError('missing', 'Die Funktion plan-assistant ist noch nicht auf dem Server hochgeladen.')
    const detail = typeof body.detail === 'string' && body.detail ? ` Technische Meldung: ${body.detail}` : ''
    throw new AssistantError(code, `${MESSAGES[code] ?? `Die KI ist fehlgeschlagen (${code}).`}${detail}`)
  }
  return { reply: typeof body.reply === 'string' ? body.reply : '', proposals: Array.isArray(body.proposals) ? body.proposals : [], approach: Array.isArray(body.approach) ? body.approach : [] }
}
