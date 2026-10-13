import Icon from './icons'
import { Logo } from './Nav'

export default function Welcome({ onConnect, onDemo }: { onConnect: () => void; onDemo: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-deep px-6 py-12 text-deepink">
      <div className="w-full max-w-md">
        <Logo size={52} />
        <h1 className="h-display mt-8 text-[40px] leading-[1.05]">Studium, Training und Alltag in einem Fluss.</h1>
        <p className="mt-4 text-base text-deepmuted">
          NiFlow zeigt dir, was heute zählt, wo du freie Zeit hast und was als Nächstes kommt. Mit eigenem Kalender, Notizen und deinen
          Daten aus Google Kalender und Intervals.icu.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-sun min-h-12 flex-1" onClick={onConnect}>
            Mit Google anmelden
          </button>
          <button type="button" className="btn min-h-12 flex-1 border border-deepink/25 text-deepink hover:bg-deepink/10" onClick={onDemo}>
            Demo ansehen
          </button>
        </div>
        <ul className="mt-10 space-y-3 text-sm">
          {[
            { icon: 'calendar' as const, text: 'Kalender mit Monat, Woche, Tag und Agenda' },
            { icon: 'note' as const, text: 'Notizen direkt an jedem Tag' },
            { icon: 'activity' as const, text: 'Geplante Trainings aus Intervals.icu' },
          ].map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-deepmuted">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-deepink/10 text-sun">
                <Icon name={f.icon} size={16} />
              </span>
              {f.text}
            </li>
          ))}
        </ul>
        <p className="mt-10 flex items-start gap-2 text-xs text-deepmuted">
          <Icon name="lock" size={14} className="mt-px shrink-0" />
          NiFlow liest deinen Google Kalender nur und ändert dort nichts. Deine eigenen Einträge sind nur für dich sichtbar.
        </p>
      </div>
    </div>
  )
}
