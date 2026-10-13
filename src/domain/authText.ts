// Anmeldung per E-Mail: Prüfung der Eingaben und verständliche deutsche Fehlermeldungen.
// Reine Funktionen ohne Netzwerk, damit sie sich testen lassen.

export type AuthMode = 'login' | 'register' | 'reset'

export const MIN_PASSWORD = 8

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Gibt eine Fehlermeldung zurück oder null, wenn die Eingaben gültig sind. */
export function validateCredentials(mode: AuthMode, email: string, password: string, repeat = ''): string | null {
  if (!EMAIL.test(email.trim())) return 'Bitte eine gültige E-Mail-Adresse eingeben.'
  if (mode === 'reset') return null
  if (!password) return 'Bitte ein Passwort eingeben.'
  if (mode === 'register') {
    if (password.length < MIN_PASSWORD) return `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`
    if (password !== repeat) return 'Die beiden Passwörter stimmen nicht überein.'
  }
  return null
}

/** Prüft ein neues Passwort (Zurücksetzen und Ändern). */
export function validateNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD) return `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`
  if (password !== repeat) return 'Die beiden Passwörter stimmen nicht überein.'
  return null
}

/** Übersetzt Fehlermeldungen von Supabase Auth in verständliches Deutsch. */
export function authErrorText(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase()
  if (!m) return 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.'
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht. Falls du dich bisher nur mit Google angemeldet hast, wähle «Mit Google anmelden».'
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse. Der Link steht in der Nachricht, die wir dir geschickt haben.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Mit dieser E-Mail gibt es schon ein Konto. Melde dich an oder setze das Passwort zurück.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Zu viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten und versuche es dann erneut.'
  if (m.includes('password') && (m.includes('weak') || m.includes('at least') || m.includes('short'))) return `Das Passwort ist zu schwach. Nimm mindestens ${MIN_PASSWORD} Zeichen.`
  if (m.includes('same password') || m.includes('different from the old')) return 'Das neue Passwort muss sich vom alten unterscheiden.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled') || m.includes('provider is not enabled')) return 'Die Anmeldung mit E-Mail ist noch nicht eingeschaltet.'
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Keine Verbindung. Bitte prüfe dein Internet und versuche es noch einmal.'
  return 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.'
}

/** Wort, das man zum Löschen des Kontos eintippen muss. */
export const DELETE_WORD = 'LÖSCHEN'

export function deleteConfirmed(input: string): boolean {
  return input.trim().toLocaleUpperCase('de-CH') === DELETE_WORD
}
