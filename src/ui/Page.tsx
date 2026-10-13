import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  /** Kurze Zeile unter dem Titel (z. B. Datum, Anzahl) */
  sub?: ReactNode
  /** Aktionen rechts neben dem Titel */
  actions?: ReactNode
  /** Breite: normal 1200px, "full" für den Kalender */
  width?: 'normal' | 'narrow' | 'full'
  children: ReactNode
}

const WIDTH = { normal: 'max-w-[1240px]', narrow: 'max-w-[880px]', full: 'max-w-none' }

/**
 * Gemeinsamer Seitenrahmen: gleiche Ränder, gleiche Kopfzeile, gleiche Abstände auf allen Seiten.
 * Abstands-System: 4er-Raster (gap-2/3/4/6/8), Seitenrand 20/32/40 px.
 */
export default function Page({ title, sub, actions, width = 'normal', children }: Props) {
  return (
    <div className={`mx-auto w-full ${WIDTH[width]} px-4 pb-36 pt-5 md:px-8 md:pb-12 md:pt-8 lg:px-10`}>
      <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3 md:mb-8">
        <div className="mr-auto min-w-0">
          <h1 className="h-display truncate text-[30px] leading-tight md:text-[38px]">{title}</h1>
          {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
