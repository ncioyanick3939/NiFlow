// Läuft die App als iOS-App (Capacitor) statt im Browser? Dort lädt die Seite von capacitor://localhost.

/** Öffentliche Adresse der Web-App. Links aus E-Mails (Bestätigen, Zurücksetzen) müssen hierhin zeigen, nicht auf capacitor://. */
export const PUBLIC_APP_URL = 'https://ncioyanick3939.github.io/NiFlow/'

export const isNativeApp = (): boolean => typeof window !== 'undefined' && window.location.protocol === 'capacitor:'
