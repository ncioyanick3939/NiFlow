// NiFlow Service Worker: macht die App installierbar und öffnet sie auch bei schwachem Netz.
// - Seite (HTML): zuerst Netz, sonst die zuletzt gespeicherte Version
// - Dateien mit Hash im Namen (JS/CSS) und Icons: aus dem Speicher, sonst Netz
// - Daten (Supabase, Google, Intervals) werden NIE zwischengespeichert
// - Erinnerungen per Web Push: auch wenn NiFlow geschlossen ist
const CACHE = 'niflow-v9'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Statische Rechtstexte (Datenschutz, Nutzungsbedingungen): direkt vom Netz, nie als App-Startseite speichern
  if (/\/(datenschutz|nutzungsbedingungen)\.html$/.test(url.pathname)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./').then((r) => r || Response.error())),
    )
    return
  }

  if (/\/assets\/|\/icons\/|manifest\.webmanifest$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})

// Erinnerung vom Server (verschlüsselt, der Browser entschlüsselt sie für uns)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NiFlow', {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: 'icons/icon-192.png',
      badge: 'icons/favicon-64.png',
      data: { url: './' },
    }),
  )
})

// Tippen auf die Benachrichtigung: offene NiFlow-Seite nach vorne holen, sonst öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow(new URL('./', self.location.href).href)
    }),
  )
})
