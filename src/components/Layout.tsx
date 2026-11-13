import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '@/components/ui'

const pageNames: Record<string, string> = {
  '/dashboard': 'Overview',
  '/reviewer': 'My reviewers',
  '/practice': 'Practice',
  '/mock': 'Mock exam',
  '/analytics': 'Analytics',
  '/onboarding': 'Set up your profile'
}

export function Layout({ children }: { children?: ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuButton = useRef<HTMLButtonElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const pageName =
    pageNames[location.pathname] || (location.pathname.startsWith('/side-by-side/') ? 'Reader' : 'Workspace')

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)')
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }
    desktop.addEventListener('change', onBreakpointChange)
    return () => desktop.removeEventListener('change', onBreakpointChange)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const sidebar = document.getElementById('main-sidebar')
    sidebar?.querySelector<HTMLButtonElement>('.sidebar-toggle')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        return
      }
      if (event.key !== 'Tab' || !sidebar) return
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
        (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (window.innerWidth <= 900) mobileMenuButton.current?.focus()
    }
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mobile-topbar">
        <button
          ref={mobileMenuButton}
          className="mobile-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-controls="main-sidebar"
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={21} />
        </button>
        <Brand />
        <span className="mobile-topbar-label">STUDY SPACE</span>
      </div>

      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onNavigate={() => setMobileOpen(false)}
        onToggle={() => {
          if (window.innerWidth <= 900) setMobileOpen(false)
          else setCollapsed((value) => !value)
        }}
      />

      {mobileOpen && (
        <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      )}

      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="workspace-topbar">
          <div className="workspace-breadcrumb">
            <span>MY STUDY SPACE</span>
            <Icon name="chevron-right" size={14} />
            <strong>{pageName}</strong>
          </div>
          <div className="workspace-topbar-right">
            <span className="workspace-date">
              <Icon name="calendar" size={16} />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {profile && <span className="workspace-program">{profile.board_program.replace(/_/g, ' ')}</span>}
          </div>
        </div>
        <div className="workspace-content">
          <Suspense
            fallback={
              <div className="container workspace-loading" role="status">
                Loading your study space…
              </div>
            }
          >
            <Outlet />
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <Brand inverse />
        <div className="auth-visual-copy">
          <span className="auth-kicker">
            <span /> YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h2>
            Good things come
            <br />
            to those who <em>prepare.</em>
          </h2>
          <p>A little focus today. A lot more confidence on exam day.</p>
        </div>
        <div className="auth-visual-footer">
          <span>THE LISENSYNC STUDY SPACE</span>
          <span>01 / 03</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <Link to="/" className="auth-back">
          <Icon name="arrow-left" size={16} /> Back to home
        </Link>
        <div className="auth-card">
          <Outlet />
          {children}
        </div>
        <div className="auth-copyright">
          © {new Date().getFullYear()} LisenSync AI <span>Made for your next chapter.</span>
        </div>
      </main>
    </div>
  )
}

export default Layout
