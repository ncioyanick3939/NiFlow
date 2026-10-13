import { parseMarkdown } from '../../domain/miniMarkdown'
import type { Inline } from '../../domain/miniMarkdown'

function Spans({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((i, k) =>
        i.bold ? (
          <strong key={k} className="font-extrabold">{i.text}</strong>
        ) : i.italic ? (
          <em key={k}>{i.text}</em>
        ) : i.code ? (
          <code key={k} className="rounded bg-ink/[0.07] px-1 py-0.5 text-[0.92em]">{i.text}</code>
        ) : (
          <span key={k}>{i.text}</span>
        ),
      )}
    </>
  )
}

/** Stellt die Antwort der KI mit Fettschrift, Listen und Absätzen dar. */
export default function RichText({ text }: { text: string }) {
  const blocks = parseMarkdown(text)
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          return (
            <p key={i} className="font-extrabold">
              <Spans items={b.inlines} />
            </p>
          )
        }
        if (b.type === 'p') {
          return (
            <p key={i} className="whitespace-pre-line">
              <Spans items={b.inlines} />
            </p>
          )
        }
        const Tag = b.type === 'ul' ? 'ul' : 'ol'
        return (
          <Tag key={i} className={`space-y-1.5 pl-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-accent`}>
            {b.items.map((it, k) => (
              <li key={k} className="pl-0.5">
                <Spans items={it} />
              </li>
            ))}
          </Tag>
        )
      })}
    </div>
  )
}
