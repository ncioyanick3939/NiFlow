import Icon from './icons'
import { Logo } from './Nav'

/** Startseite ohne Anmeldung: ruhig, typografisch, ein klarer Hauptknopf. */
export default function Welcome({ onConnect, onDemo }: { onConnect: () => void; onDemo: () => void }) {
  const today = new Date()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-display text-[21px] font-semibold tracking-[-0.03em]">NiFlow</span>
        </div>
        <p className="tnum mt-12 border-t border-line pt-3 text-[13px] text-muted">
          {today.toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
        <h1 className="h-display mt-3 text-[38px] leading-[1.05] md:text-[46px]">Studium, Training und Alltag in einem Plan.</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          NiFlow zeigt dir, was heute zählt, wo du freie Zeit hast und was als Nächstes kommt. Mit eigenem Kalender, Aufgaben, Prüfungen und
          deinen Daten aus Google Kalender und Intervals.icu.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary min-h-12 flex-1" onClick={onConnect}>
            Mit Google anmelden
          </button>
          <button type="button" className="btn-outline min-h-12 flex-1" onClick={onDemo}>
            Demo ansehen
          </button>
        </div>
        <dl className="mt-12 divide-y divide-line border-y border-line text-sm">
          {[
            ['Kalender', 'Monat, Woche, Tag und Agenda, mit Notizen'],
            ['Aufgaben', 'Heute, als Nächstes, überfällig'],
            ['Prüfungen', 'Countdown und Lernplan'],
            ['Training', 'Geplant und absolviert aus Intervals.icu'],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6.5rem,minmax(0,1fr)] gap-3 py-2.5">
              <dt className="font-medium">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 flex items-start gap-2 text-xs text-muted">
          <Icon name="lock" size={14} className="mt-px shrink-0" />
          Deine bestehenden Google-Kalender werden nie verändert. Auf Wunsch trägt NiFlow deine eigenen Termine in einen separaten Kalender «NiFlow» ein.
          Deine Einträge sind nur für dich sichtbar.
        </p>
      </div>
    </div>
  )
}
