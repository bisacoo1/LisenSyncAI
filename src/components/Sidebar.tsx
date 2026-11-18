import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { Icon, Tooltip, type IconName } from '@/components/ui'

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { path: '/reviewers', label: 'My reviewers', icon: 'reviewer' },
  { path: '/side-by-side', label: 'Side by side', icon: 'move' },
  { path: '/practice', label: 'Practice', icon: 'practice' },
  { path: '/mock', label: 'Mock exam', icon: 'mock' },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' }
]

const uploadItems: { path: string; label: string; icon: IconName; tab: string }[] = [
  { path: '/reviewer?tab=upload', label: 'Upload & materials', icon: 'upload', tab: 'upload' }
]

export function Sidebar({
  open = false,
  onToggle,
  onNavigate,
  collapsed = false
}: {
  open?: boolean
  onToggle?: () => void
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isCompact = collapsed && !open
  const initials = (profile?.full_name || 'LisenSync Candidate')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <aside
      id="main-sidebar"
      className={`sidebar${open ? ' open' : ''}${isCompact ? ' collapsed' : ''}`}
      aria-label="Main sidebar"
    >
      <div className="sidebar-brand">
        <Brand inverse compact={isCompact} />
      </div>
      <div className="sidebar-nav-heading">
        <span>YOUR WORKSPACE</span>
        {onToggle && (
          <Tooltip content={open ? 'Close menu' : isCompact ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
            <button
              className="sidebar-toggle"
              onClick={onToggle}
              aria-label={open ? 'Close menu' : isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={open ? 'x' : isCompact ? 'chevron-right' : 'chevron-left'} size={16} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Workspace navigation">
        <ul className="sidebar-list">
          {navItems.filter((item) => item.path !== '/mock' || profile?.track !== 'course').map((item) => {
            const active = item.path === '/side-by-side'
              ? location.pathname.startsWith('/side-by-side')
              : location.pathname === item.path
            const link = (
              <Link
                to={item.path}
                className={`sidebar-item${active ? ' active' : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={19} />
                <span className="sidebar-label">{item.label}</span>
                {active && <span className="sidebar-active-dot" aria-hidden="true" />}
              </Link>
            )
            return (
              <li key={item.path}>
                {isCompact ? (
                  <Tooltip content={item.label} position="right" delay={300}>
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}

          {/* Keep uploads and saved reviewer materials reachable separately from the library. */}
          <li className="sidebar-section">
            <span className="sidebar-section-label">UPLOAD</span>
          </li>
          {uploadItems.map((item) => {
            const active =
              (location.pathname === '/reviewer' && location.search.includes(`tab=${item.tab}`))
            const link = (
              <Link
                to={item.path}
                className={`sidebar-item${active ? ' active' : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={19} />
                <span className="sidebar-label">{item.label}</span>
                {active && <span className="sidebar-active-dot" aria-hidden="true" />}
              </Link>
            )
            return (
              <li key={item.path}>
                {isCompact ? (
                  <Tooltip content={item.label} position="right" delay={300}>
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <div className="sidebar-note-rx" aria-hidden="true">Rx</div>
          <span>
            <strong>Daily PhLE Dose</strong>
            <small>Steady recall builds clinical mastery.</small>
          </span>
        </div>
        {user && (
          <div className="sidebar-profile">
            <span className="sidebar-avatar">{initials}</span>
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-name">{profile?.full_name || 'Pharmacy candidate'}</span>
              <span className="sidebar-profile-program">
                {profile ? (profile.track === 'course' ? 'Course mode' : PHARMACY_PROGRAM.shortName) : 'Set up your profile'}
              </span>
            </div>
            <Tooltip content="Sign out" position="right">
              <button
                className="sidebar-signout"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <Icon name="logout" size={17} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
