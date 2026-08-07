import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.tsx'
import { QueryProvider } from './providers/QueryProvider'
import ErrorBoundary from './components/ui/ErrorBoundary'

(window as Window & { React?: typeof React }).React = React;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
)
