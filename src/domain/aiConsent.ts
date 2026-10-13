// Einwilligung für den KI-Planer (Apple App Store Richtlinie 5.1.2(i): ausdrückliche Zustimmung,
// bevor persönliche Daten an eine KI eines Drittanbieters gehen). Gespeichert pro Person auf diesem Gerät.

export const AI_CONSENT_KEY = 'niflow.ai-consent.v1'
/** Erhöhen, wenn sich ändert, was an die KI geht: dann wird neu gefragt. */
export const AI_CONSENT_VERSION = 1

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type Map = Record<string, { v: number; at: string }>

function readMap(storage: StorageLike | null): Map {
  try {
    const raw = storage?.getItem(AI_CONSENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Map) : {}
  } catch {
    return {}
  }
}

export function hasAiConsent(storage: StorageLike | null, userId: string | null | undefined): boolean {
  if (!userId) return false
  const entry = readMap(storage)[userId]
  return !!entry && entry.v === AI_CONSENT_VERSION
}

/** Speichert oder widerruft die Einwilligung. Gibt false zurück, wenn der Speicher nicht nutzbar ist. */
export function setAiConsent(storage: StorageLike | null, userId: string, on: boolean, now = new Date()): boolean {
  try {
    if (!storage) return false
    const map = readMap(storage)
    if (on) map[userId] = { v: AI_CONSENT_VERSION, at: now.toISOString() }
    else delete map[userId]
    storage.setItem(AI_CONSENT_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}
