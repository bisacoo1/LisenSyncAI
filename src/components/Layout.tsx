import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { useAuth } from '@/context/AuthContext'
import { Button, Icon, Badge } from '@/components/ui'

export function Layout() {
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <div className="mobile-topbar">
        <button className="mobile-toggle" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
          <Icon name="menu" size={22} />
        </button>
        <span className="brand">LisenSync AI</span>
        {profile && (
          <Badge variant="primary" size="sm" style={{ fontWeight: 500 }}>
            <Icon name="flag" size={11} />
            {profile.board_program.replace('_', ' ')}
          </Badge>
        )}
      </div>

      <Sidebar
        open={mobileOpen}
        onToggle={() => {
          if (window.innerWidth <= 900) setMobileOpen(o => !o)
          else setCollapsed(c => !c)
        }}
      />

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <div className="auth-actions">
        {profile && (
          <Button variant="ghost" size="sm" leftIcon="logout" onClick={async () => { await signOut() }}>
            Sign out
          </Button>
        )}
      </div>
    </div>
  )
}

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Outlet />
      </div>
    </div>
  )
}

export default Layout