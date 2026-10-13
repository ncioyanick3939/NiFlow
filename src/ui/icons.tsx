import type { ReactElement } from 'react'

// Eigener, einheitlicher Icon-Satz (24er Raster, Linienstärke 1.75). Keine Emojis.
const PATHS: Record<string, ReactElement> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="2" />
      <rect x="13" y="3" width="8" height="6" rx="2" />
      <rect x="13" y="11" width="8" height="10" rx="2" />
      <rect x="3" y="15" width="8" height="6" rx="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  note: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5" />
      <path d="M11 7h9M11 13h9M11 19h9" />
    </>
  ),
  exam: (
    <>
      <path d="M3 9l9-4 9 4-9 4z" />
      <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11M21 9v5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  repeat: <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  refresh: <path d="M20 11A8 8 0 0 0 5.5 7M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  dumbbell: <path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" />,
  bike: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l4-7h5l3 7M10 9L8.5 6H6.5M13 9l-2 7" />
    </>
  ),
  swim: (
    <>
      <circle cx="16" cy="6" r="1.8" />
      <path d="M5 11l6-3 4 3M3 16c2 0 2-1.5 4-1.5S9 16 11 16s2-1.5 4-1.5S17 16 19 16s2-1 2-1M3 20c2 0 2-1.5 4-1.5S9 20 11 20s2-1.5 4-1.5S17 20 19 20s2-1 2-1" />
    </>
  ),
  run: (
    <>
      <circle cx="14" cy="5" r="1.8" />
      <path d="M8 21l3-6 3 2 1 4M11 15l-1-4 4-2 2 3 3 1M8 11l3-2" />
    </>
  ),
  cloud: <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1 0 7.5z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName
  size?: number
  className?: string
}

export default function Icon({ name, size = 20, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}

/** Icon passend zur Sportart aus Intervals.icu. */
export function sportIcon(sport?: string): IconName {
  const s = (sport ?? '').toLowerCase()
  if (s.includes('swim')) return 'swim'
  if (s.includes('ride') || s.includes('bike') || s.includes('cycl')) return 'bike'
  if (s.includes('run')) return 'run'
  return 'dumbbell'
}
