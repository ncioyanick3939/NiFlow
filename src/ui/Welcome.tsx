import Icon from './icons'
import type { IconName } from './icons'
import { Logo } from './Nav'

/** Startseite ohne Anmeldung: freundlich, ein klarer Hauptknopf, vier farbige Bereiche. */
export default function Welcome({ onConnect, onDemo }: { onConnect: () => void; onDemo: () => void }) {
  const today = new Date()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5">
          <Logo size={38} />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">NiFlow</span>
        </div>
        <p className="chip mt-10 bg-accent/10 text-accent">
          {today.toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
        <h1 className="h-display mt-4 text-[38px] leading-[1.05] md:text-[48px]">Studium, Training und Alltag <span className="text-accent">in einem Plan.</span></h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          NiFlow zeigt dir, was heute zählt, wo du freie Zeit hast und was als Nächstes kommt. Mit eigenem Kalender, Aufgaben, Prüfungen und
          deinen Daten aus Google Kalender und Intervals.icu.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary min-h-12 flex-1 rounded-2xl" onClick={onConnect}>
            Mit Google anmelden
          </button>
          <button type="button" className="btn-outline min-h-12 flex-1 rounded-2xl" onClick={onDemo}>
            Demo ansehen
          </button>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3">
          {(
            [
              ['Kalender', 'Monat, Woche, Tag und Agenda', 'calendar', 'cat-work'],
              ['Aufgaben', 'Heute, als Nächstes, Inbox', 'tasks', 'cat-private'],
              ['Prüfungen', 'Countdown und Lernplan', 'exam', 'cat-training'],
              ['Training', 'Geplant und absolviert aus Intervals.icu', 'activity', 'cat-study'],
            ] as [string, string, IconName, string][]
          ).map(([k, v, icon, tint]) => (
            <div key={k} className={`${tint} rounded-3xl bg-cat/[0.13] p-4`}>
              <span className="dot-cat mb-3 h-10 w-10">
                <Icon name={icon} size={19} />
              </span>
              <p className="text-[15px] font-extrabold">{k}</p>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-muted">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-start gap-2 text-xs text-muted">
          <Icon name="lock" size={14} className="mt-px shrink-0" />
          Deine bestehenden Google-Kalender werden nie verändert. Auf Wunsch trägt NiFlow deine eigenen Termine in einen separaten Kalender «NiFlow» ein.
          Deine Einträge sind nur für dich sichtbar.
        </p>
      </div>
    </div>
  )
}
