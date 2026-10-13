// Sehr kleine Markdown-Auswertung für die Antworten des KI-Planers: Absätze, Aufzählungen,
// nummerierte Listen, Überschriften sowie **fett**, *kursiv* und `Code`.
// Es entsteht nur eine Struktur, die die Oberfläche als normalen Text darstellt (kein HTML, daher sicher).

export interface Inline {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
}

export type Block =
  | { type: 'p'; inlines: Inline[] }
  | { type: 'h'; inlines: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }

const TOKEN = /\*\*([^*]+?)\*\*|`([^`]+?)`|\*([^*\s][^*]*?)\*/g

export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of s.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true })
    else if (m[2] !== undefined) out.push({ text: m[2], code: true })
    else out.push({ text: m[3], italic: true })
    last = m.index! + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  // Übrig gebliebene einzelne Sterne (unvollständiges Markdown) nicht anzeigen
  return out.map((i) => (i.bold || i.italic || i.code ? i : { ...i, text: i.text.replace(/\*\*/g, '') })).filter((i) => i.text !== '')
}

const BULLET = /^\s*(?:[-*•–])\s+(.*)$/
const NUMBER = /^\s*\d{1,2}[.)]\s+(.*)$/
const HEAD = /^\s{0,3}#{1,4}\s+(.*)$/

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: Inline[][] } | null = null
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', inlines: parseInline(para.join('\n')) })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const head = HEAD.exec(line)
    if (head) {
      flushPara()
      flushList()
      blocks.push({ type: 'h', inlines: parseInline(head[1]) })
      continue
    }
    const bullet = BULLET.exec(line)
    const num = bullet ? null : NUMBER.exec(line)
    if (bullet || num) {
      flushPara()
      const type = bullet ? 'ul' : 'ol'
      if (list && list.type !== type) flushList()
      if (!list) list = { type, items: [] }
      list.items.push(parseInline((bullet ?? num)![1]))
      continue
    }
    // Eingerückte Fortsetzung eines Listenpunkts
    if (list && /^\s{2,}\S/.test(raw)) {
      const items: Inline[][] = list.items
      items[items.length - 1] = [...items[items.length - 1], { text: ' ' }, ...parseInline(line.trim())]
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return blocks
}
