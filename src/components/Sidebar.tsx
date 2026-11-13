import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { Icon, Tooltip, type IconName } from '@/components/ui'

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { path: '/reviewer', label: 'My reviewers', icon: 'reviewer' },
  { path: '/practice', label: 'Practice', icon: 'practice' },
  { path: '/mock', label: 'Mock exam', icon: 'mock' },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' }
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
          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path === '/reviewer' && location.pathname.startsWith('/side-by-side/'))
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
          <Icon name="sparkles" size={17} />
          <span>
            <strong>A little, every day.</strong>
            <small>It all adds up to exam day.</small>
          </span>
        </div>
        {user && (
          <div className="sidebar-profile">
            <span className="sidebar-avatar">{initials}</span>
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-name">{profile?.full_name || 'Licensure candidate'}</span>
              <span className="sidebar-profile-program">
                {profile ? profile.board_program.replace(/_/g, ' ') : 'Set up your profile'}
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
