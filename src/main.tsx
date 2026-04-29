import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if (typeof window !== 'undefined' && window.location.hostname.toLowerCase() === 'www.csgn.fun') {
  const target = `https://csgn.fun${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(target)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
