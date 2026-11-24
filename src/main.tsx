import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui'
import '@fontsource-variable/figtree/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './index.css'
import './design.css'

// Apply the workspace theme before the first render; navy dark is the new default.
try {
  const theme = localStorage.getItem('workspace-theme')
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(theme === 'light' ? 'light' : 'dark')
} catch {
  document.documentElement.classList.add('dark')
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
