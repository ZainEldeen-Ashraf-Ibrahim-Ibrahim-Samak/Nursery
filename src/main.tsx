import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/layout/ErrorBoundary.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost net: catches anything thrown outside the router (auth bootstrap, i18n, layout)
        so a failure there shows a readable error instead of a blank window. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
