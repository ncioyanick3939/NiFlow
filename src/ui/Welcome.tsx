import Icon from './icons'
import { Logo } from './Nav'

export default function Welcome({ onConnect, onDemo }: { onConnect: () => void; onDemo: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Logo size={44} />
        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">Studium, Training und Alltag in einem Fluss.</h1>
        <p className="mt-3 text-base text-muted">
          NiFlow zeigt dir, was heute zählt, wo du freie Zeit hast und was als Nächstes kommt. Mit eigenem Kalender, Notizen und deinen
          Daten aus Google Kalender und Intervals.icu.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary min-h-12 flex-1" onClick={onConnect}>
            Mit Google anmelden
          </button>
          <button type="button" className="btn-outline min-h-12 flex-1" onClick={onDemo}>
            Demo ansehen
          </button>
        </div>
        <ul className="mt-10 space-y-3 text-sm">
          {[
            { icon: 'calendar' as const, text: 'Kalender mit Monat, Woche, Tag und Agenda' },
            { icon: 'note' as const, text: 'Notizen direkt an jedem Tag' },
            { icon: 'activity' as const, text: 'Geplante Trainings aus Intervals.icu' },
          ].map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-muted">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-ink">
                <Icon name={f.icon} size={16} />
              </span>
              {f.text}
            </li>
          ))}
        </ul>
        <p className="mt-10 flex items-start gap-2 text-xs text-muted">
          <Icon name="lock" size={14} className="mt-px shrink-0" />
          NiFlow liest deinen Google Kalender nur und ändert dort nichts. Deine eigenen Einträge sind nur für dich sichtbar.
        </p>
      </div>
    </div>
  )
}
