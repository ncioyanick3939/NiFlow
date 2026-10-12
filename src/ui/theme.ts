import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'niflow-theme'

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Speicher nicht verfügbar: Standard verwenden
  }
  return 'system'
}

function apply(choice: ThemeChoice) {
  const dark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** Hell, Dunkel oder System. Die Wahl wird nur in diesem Browser gespeichert. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read)

  useEffect(() => {
    apply(choice)
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  const set = useCallback((next: ThemeChoice) => {
    setChoice(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // ignorieren
    }
  }, [])

  return { choice, set }
}
