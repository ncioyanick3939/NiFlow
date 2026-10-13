import { useCallback, useState } from 'react'
import { hasAiConsent, setAiConsent } from '../../domain/aiConsent'
import type { StorageLike } from '../../domain/aiConsent'

const storage = (): StorageLike | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Einwilligung zum KI-Planer für die angemeldete Person. Ist der Browser-Speicher gesperrt,
 * gilt sie nur, solange die App offen ist (dann wird beim nächsten Start wieder gefragt).
 */
export function useAiConsent(userId: string | null | undefined) {
  const [given, setGiven] = useState(() => hasAiConsent(storage(), userId))
  const [forUser, setForUser] = useState(userId)
  if (forUser !== userId) {
    setForUser(userId)
    setGiven(hasAiConsent(storage(), userId))
  }

  const give = useCallback(() => {
    if (userId) setAiConsent(storage(), userId, true)
    setGiven(true)
  }, [userId])
  const revoke = useCallback(() => {
    if (userId) setAiConsent(storage(), userId, false)
    setGiven(false)
  }, [userId])

  return { given, give, revoke }
}
