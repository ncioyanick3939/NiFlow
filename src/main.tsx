import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
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
