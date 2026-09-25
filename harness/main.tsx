import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@bp/ui/tokens.css'
import '@bp/ui/components.css'
import './harness.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
