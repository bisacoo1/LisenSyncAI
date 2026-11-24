import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/context/AuthContext'
import { getLevelProgress } from '@/lib/analytics'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { Icon, Modal, useToast } from '@/components/ui'
import { PROGRAM_SHORT_NAMES } from '@/lib/syllabus'
import { AccountAvatarPicker } from '@/components/AccountAvatarPicker'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import FloatingLiloChat from '@/components/FloatingLiloChat'

const pageNames: Record<string, string> = {
  '/dashboard': 'Overview',
  '/reviewers': 'My reviewers',
  '/reviewer': 'Upload materials',
  '/side-by-side': 'Side by side',
  '/practice': 'Study mode',
  '/mock': 'Mock exam',
  '/analytics': 'Analytics',
  '/achievements': 'Achievements',
  '/game': 'Game mode',
  '/onboarding': 'Set up your profile'
}

export function Layout({ children, focus = false }: { children?: ReactNode; focus?: boolean }) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('workspace-theme')
      if (stored === 'dark' || stored === 'light') return stored === 'dark'
      return true
    }
    return true
  })
  const mobileMenuButton = useRef<HTMLButtonElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const pageName =
    pageNames[location.pathname] || (location.pathname.startsWith('/side-by-side/') ? 'Reader' : 'Workspace')
  const isDashboard = location.pathname === '/dashboard'
  const accountName = profile?.full_name?.trim() || 'Pharmacy candidate'
  const accountFirstName = accountName.split(/\s+/)[0]
  const accountInitials = accountName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const accountXp = Math.max(0, profile?.xp ?? 0)
  const accountLevelProgress = getLevelProgress(accountXp)

  const handleSignOut = async () => {
    setAccountMenuOpen(false)
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not sign out',
        message: error instanceof Error ? error.message : 'Please try again.'
      })
    }
  }

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
    localStorage.setItem('workspace-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(d => !d)

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

  useEffect(() => {
    if (!accountMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (avatarPreviewOpen) return
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAccountMenuOpen(false)
      accountButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountMenuOpen, avatarPreviewOpen])

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}${focus ? ' app-shell--focus' : ''}${isDark ? ' app-shell--navy' : ''}${isDashboard && isDark ? ' app-shell--dashboard' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {!focus && (
        <>
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
            <span className="mobile-topbar-label">BS PHARMACY · PhLE</span>
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
        </>
      )}

      <main className="app-main" id="main-content" tabIndex={-1} aria-label={pageName} data-route-main>
        {!focus && (
          <div className="workspace-topbar">
            <div className="workspace-breadcrumb">
              <span>PHARMACY STUDY SPACE</span>
              <Icon name="chevron-right" size={14} />
              <strong>{pageName}</strong>
            </div>
            <div className="workspace-topbar-right">
              <span className="workspace-date">
                <Icon name="calendar" size={16} />
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <button
                className="theme-toggle min-touch touch-manipulation"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={isDark}
              >
                <Icon name={isDark ? 'sun' : 'moon'} size={16} />
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>
              {profile && (
                <div className="workspace-account" ref={accountMenuRef}>
                  <button
                    ref={accountButtonRef}
                    className="workspace-account-trigger"
                    type="button"
                    aria-label={`Account menu for ${accountName}`}
                    aria-expanded={accountMenuOpen}
                    aria-controls="workspace-account-panel"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                  >
                    <ProfileAvatar
                      className="workspace-account-avatar"
                      avatarId={profile.avatar_id}
                      avatarPath={profile.avatar_path}
                      avatarBorderId={profile.avatar_border}
                      initials={accountInitials}
                    />
                    <span className="workspace-account-trigger-name">{accountFirstName}</span>
                    <Icon name="chevron-down" size={14} aria-hidden="true" />
                  </button>
                  <div
                    id="workspace-account-panel"
                    className="workspace-account-panel"
                    role="region"
                    aria-label="Account details"
                    hidden={!accountMenuOpen}
                  >
                    <div className="workspace-account-profile">
                      <button
                        type="button"
                        className="workspace-account-panel-avatar-button"
                        aria-label={`Expand ${accountName}'s profile picture`}
                        aria-haspopup="dialog"
                        onClick={() => setAvatarPreviewOpen(true)}
                      >
                        <ProfileAvatar
                          className="workspace-account-panel-avatar"
                          avatarId={profile.avatar_id}
                          avatarPath={profile.avatar_path}
                          avatarBorderId={profile.avatar_border}
                          initials={accountInitials}
                        />
                      </button>
                      <div className="workspace-account-identity">
                        <strong>{accountName}</strong>
                        {user?.email && <span>{user.email}</span>}
                        <small>{profile.track === 'course' ? 'Course mode' : PHARMACY_PROGRAM.shortName}</small>
                      </div>
                    </div>
                    <button
                      className="workspace-account-avatar-edit"
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        setAvatarPickerOpen(true)
                      }}
                    >
                      <Icon name="image" size={16} aria-hidden="true" />
                      Change avatar
                    </button>
                    <div className="workspace-account-study-level">
                      <div className="workspace-account-study-level-heading">
                        <span>Study level</span>
                        <strong>{accountLevelProgress.level}</strong>
                      </div>
                      <div className="workspace-account-xp">
                        <div className="workspace-account-xp-copy">
                          <span>{accountLevelProgress.xpIntoLevel} / {accountLevelProgress.xpRequired} XP</span>
                          <strong>{accountLevelProgress.xpRemaining} XP to level up</strong>
                        </div>
                        <div
                          className="workspace-account-xp-track"
                          role="progressbar"
                          aria-label={`Progress to level ${accountLevelProgress.level + 1}`}
                          aria-valuemin={0}
                          aria-valuemax={accountLevelProgress.xpRequired}
                          aria-valuenow={accountLevelProgress.xpIntoLevel}
                        >
                          <span style={{ width: `${accountLevelProgress.progressPercent}%` }} />
                        </div>
                        <small>{accountXp} XP earned total</small>
                      </div>
                    </div>
                    {user && (
                      <button className="workspace-account-signout" type="button" onClick={handleSignOut}>
                        <Icon name="logout" size={16} aria-hidden="true" />
                        Sign out
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {profile && (
          <Modal
            open={avatarPreviewOpen}
            onClose={() => setAvatarPreviewOpen(false)}
            title={`${accountName}'s profile picture`}
            size="sm"
            className="workspace-avatar-preview-modal"
          >
            <div className="workspace-avatar-preview">
              <ProfileAvatar
                className="workspace-avatar-preview-image"
                avatarId={profile.avatar_id}
                avatarPath={profile.avatar_path}
                avatarBorderId={profile.avatar_border}
                initials={accountInitials}
              />
            </div>
          </Modal>
        )}
        {profile && <AccountAvatarPicker open={avatarPickerOpen} onClose={() => setAvatarPickerOpen(false)} />}
        <div className={`workspace-content${focus ? ' workspace-content--focus' : ''}`}>
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
      {profile && (
        <FloatingLiloChat program={profile.board_program} track={profile.track ?? 'board'} />
      )}
    </div>
  )
}

export function AuthLayout({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const pageName = location.pathname === '/register' ? 'Create account' : 'Sign in'

  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <Brand inverse />
        <div className="auth-visual-copy">
          <span className="auth-kicker">
            <span /> BS PHARMACY · PRC PhLE REVIEW
          </span>
          <h2>
            Good things come
            <br />
            to those who <em>prepare.</em>
          </h2>
          <p>Focused review across all 6 Pharmacy board modules—for steady confidence on PhLE exam day.</p>
          <ul className="auth-module-pills" aria-label="BS Pharmacy PhLE modules">
            {PHARMACY_PROGRAM.subjectDetails.map((mod) => (
              <li key={mod.name}>
                <span>{mod.moduleNumber}</span>
                {mod.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-visual-footer">
          <span>BS PHARMACY STUDY SPACE</span>
          <span>06 PhLE MODULES</span>
        </div>
      </aside>
      <main className="auth-main" tabIndex={-1} aria-label={pageName} data-route-main>
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
          © {new Date().getFullYear()} Pharmora AI <span>Built for future Registered Pharmacists (RPh).</span>
        </div>
      </main>
    </div>
  )
}

export default Layout
