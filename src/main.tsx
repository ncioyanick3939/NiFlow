import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
// Schriften lokal mitgeliefert (kein Abruf bei Google, funktionieren offline). Nur lateinische Zeichen.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service Worker nur in der veröffentlichten Version (nicht beim Entwickeln)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ohne Service Worker funktioniert die App weiterhin normal
    })
  })
}
