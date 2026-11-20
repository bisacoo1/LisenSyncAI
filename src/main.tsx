import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/dm-serif-display/latin-400.css'
import '@fontsource/dm-serif-display/latin-400-italic.css'
import './index.css'
import './design.css'
import './reference-theme.css'

// Restore the workspace preference on public pages too, before the first render.
try {
  const theme = localStorage.getItem('theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.classList.add(theme)
} catch {
  // If storage is unavailable, the stylesheet follows the system preference.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
