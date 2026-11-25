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
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Check, ShieldCheck, Sparkles } from 'lucide-react'
import lilo from '@/assets/mascot/mascot-avatar-512.png'

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
  const isReviewersPage = location.pathname === '/reviewers' || location.pathname.startsWith('/side-by-side')
  const isGamePage = location.pathname === '/game'
  const isLeaderboardPage = location.pathname === '/leaderboard'
  const isMorePage = location.pathname === '/mock' || location.pathname === '/analytics'
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
            <Brand to="/dashboard" />
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
            <div className="workspace-topbar-brand">
              <Brand to="/dashboard" />
            </div>
            <nav className="workspace-primary-nav" aria-label="Primary navigation">
              <Link
                to="/dashboard"
                className={`workspace-primary-nav-link${isDashboard ? ' active' : ''}`}
                aria-current={isDashboard ? 'page' : undefined}
              >
                Overview
              </Link>
              <Link
                to="/reviewers"
                className={`workspace-primary-nav-link${isReviewersPage ? ' active' : ''}`}
                aria-current={isReviewersPage ? 'page' : undefined}
              >
                My Reviewers
              </Link>
              <Link
                to="/game"
                className={`workspace-primary-nav-link${isGamePage ? ' active' : ''}`}
                aria-current={isGamePage ? 'page' : undefined}
              >
                Game Mode
              </Link>
              <Link
                to="/leaderboard"
                className={`workspace-primary-nav-link${isLeaderboardPage ? ' active' : ''}`}
                aria-current={isLeaderboardPage ? 'page' : undefined}
              >
                Leaderboards
              </Link>
              <details className="workspace-primary-more">
                <summary className={`workspace-primary-nav-link${isMorePage ? ' active' : ''}`}>
                  More
                  <Icon name="chevron-down" size={14} aria-hidden="true" />
                </summary>
                <div className="workspace-primary-more-menu">
                  {profile?.track !== 'course' && (
                    <Link to="/mock" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}>
                      Mock exam
                    </Link>
                  )}
                  <Link to="/analytics" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}>
                    Analytics
                  </Link>
                </div>
              </details>
            </nav>
            <div className="workspace-breadcrumb">
              <span>PHARMACY STUDY SPACE</span>
              <Icon name="chevron-right" size={14} />
              <strong>{pageName}</strong>
            </div>
            <div className="workspace-topbar-right">
              <div className="workspace-primary-actions">
                <Link to="/reviewer?tab=upload" className="workspace-upload-link">
                  <Icon name="upload" size={16} aria-hidden="true" />
                  <span>Upload</span>
                </Link>
                <Link
                  to="/friends"
                  className={`workspace-nav-icon-link${location.pathname === '/friends' ? ' active' : ''}`}
                  aria-label="Friends"
                  aria-current={location.pathname === '/friends' ? 'page' : undefined}
                  title="Friends"
                >
                  <Icon name="users" size={18} aria-hidden="true" />
                  <span>Friends</span>
                </Link>
                <Link
                  to="/achievements"
                  className={`workspace-nav-icon-link${location.pathname === '/achievements' ? ' active' : ''}`}
                  aria-label="Achievements"
                  aria-current={location.pathname === '/achievements' ? 'page' : undefined}
                  title="Achievements"
                >
                  <Icon name="trophy" size={18} aria-hidden="true" />
                  <span>Achievements</span>
                </Link>
              </div>
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
  const isRegister = location.pathname === '/register'

  return (
    <div className={`public-auth${isRegister ? ' public-auth--register' : ''}`}>
      <a className="public-skip" href="#auth-content">
        Skip to form
      </a>
      <header className="public-auth-header">
        <Brand />
        <div>
          <span>
            {isRegister ? 'Already part of Pharmora?' : 'New to Pharmora?'}
          </span>
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Log in' : 'Create account'} <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <div className="public-auth-grid">
        <aside
          className="public-auth-story"
          aria-label="Your pharmacy study companion"
        >
          <span className="public-pill">
            <Sparkles size={15} /> Your next chapter starts here
          </span>
          <h2>
            {isRegister ? (
              <>
                Big dreams.
                <br />
                Small steps.
                <br />
                Let’s get you there.
              </>
            ) : (
              <>
                A fresh session.
                <br />A clearer mind.
                <br />
                You’ve got this.
              </>
            )}
          </h2>
          <p>
            Your notes, a little practice, and a study companion
            <br className="public-auth-linebreak" /> that’s with you all the way
            to RPh.
          </p>
          <div className="public-auth-mascot">
            <span className="public-auth-mascot-circle" />
            <span className="public-auth-float public-auth-float--one">
              <BookOpen size={18} /> Make it stick.
            </span>
            <img src={lilo} alt="Lilo, your owl study companion" />
            <span className="public-auth-float public-auth-float--two">
              <BrainCircuit size={18} /> One concept at a time.
            </span>
          </div>
          <div className="public-auth-story-footer">
            <span>
              <Check size={15} /> Your own materials
            </span>
            <span>
              <Check size={15} /> Your own pace
            </span>
            <span>
              <Check size={15} /> Real progress
            </span>
          </div>
        </aside>
        <main
          id="auth-content"
          className="public-auth-main"
          tabIndex={-1}
          aria-label={isRegister ? 'Create account' : 'Log in'}
          data-route-main
        >
          <div className="public-auth-form-wrap">
            <Link to="/" className="public-auth-back">
              <ArrowLeft size={15} /> Back to home
            </Link>
            {children || <Outlet />}
            <p className="public-auth-security">
              <ShieldCheck size={15} /> A focused space for your pharmacy
              journey.
            </p>
          </div>
        </main>
      </div>
      <footer className="public-auth-footer">
        <span>© {new Date().getFullYear()} Pharmora AI</span>
        <span>Made for your journey to RPh.</span>
      </footer>
    </div>
  )
}

export default Layout
