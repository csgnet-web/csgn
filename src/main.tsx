import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

/**
 * Register the service worker.
 *
 * It caches nothing (see public/sw.js) — it is here so the browser considers
 * CSGN installable, which is the precondition for the share target that lets
 * somebody push a clip in from Instagram or TikTok with one tap.
 *
 * Failure is silently ignored on purpose: no part of the app depends on it,
 * and an unsupported browser or a blocked registration must not produce a
 * console error on a page that is otherwise working perfectly.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
