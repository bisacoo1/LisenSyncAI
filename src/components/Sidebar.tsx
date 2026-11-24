import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { Icon, Tooltip, type IconName } from '@/components/ui'
import { ProfileAvatar } from '@/components/ProfileAvatar'

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { path: '/reviewers', label: 'My reviewers', icon: 'reviewer' },
  { path: '/mock', label: 'Mock exam', icon: 'mock' },
  { path: '/game', label: 'Game mode', icon: 'zap' },
  { path: '/leaderboard', label: 'Leaderboards', icon: 'podium' },
  { path: '/friends', label: 'Friends', icon: 'users' },
  { path: '/achievements', label: 'Achievements', icon: 'trophy' },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' }
]

const uploadItems: { path: string; label: string; icon: IconName; tab: string }[] = [
  { path: '/reviewer?tab=upload', label: 'Upload materials', icon: 'upload', tab: 'upload' }
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
  const { profile, user } = useAuth()
  const location = useLocation()
  const isCompact = collapsed && !open
  const initials = (profile?.full_name || 'Pharmora Candidate')
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
            const active = item.path === '/reviewers'
              ? location.pathname === item.path || location.pathname.startsWith('/side-by-side')
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
              (location.pathname === '/reviewer' && (!location.search || new URLSearchParams(location.search).get('tab') === item.tab))
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
            <ProfileAvatar
              className="sidebar-avatar"
              avatarId={profile?.avatar_id}
              avatarPath={profile?.avatar_path}
              avatarBorderId={profile?.avatar_border}
              initials={initials}
            />
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-program">
                {profile ? (profile.track === 'course' ? 'Course mode' : PHARMACY_PROGRAM.shortName) : 'Set up your profile'}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
