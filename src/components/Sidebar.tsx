import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Icon, Tooltip } from '@/components/ui'

export function Sidebar({ open = false, onToggle, collapsed = false }: { open?: boolean; onToggle?: () => void; collapsed?: boolean }) {
  const { profile } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/reviewer', label: 'Reviewer', icon: 'reviewer' },
    { path: '/practice', label: 'Practice', icon: 'practice' },
    { path: '/mock', label: 'Mock Exam', icon: 'mock' },
    { path: '/analytics', label: 'Analytics', icon: 'analytics' },
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main sidebar">
      <div className="sidebar-brand">
        <Icon name="logo" size={26} style={{ color: 'var(--primary)' }} />
        <span className="sidebar-brand-text">LisenSync AI</span>
        {onToggle && (
          <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
            <button
              className="sidebar-toggle"
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: 6, borderRadius: 8, cursor: 'pointer', marginLeft: 'auto' }}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="sidebar-nav">
        <ul className="sidebar-list">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <li key={item.path}>
                <Tooltip content={item.label} position="right" delay={300}>
                  <Link
                    to={item.path}
                    className={`sidebar-item ${active ? 'active' : ''}`}
                    aria-label={item.label}
                  >
                    <span className="sidebar-icon">
                      <Icon name={item.icon as any} size={20} />
                    </span>
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {profile && (
          <div className="sidebar-profile">
            <Icon name="user" size={16} />
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-name">{profile.full_name || 'Licensure Candidate'}</span>
              <span className="sidebar-profile-program">{profile.board_program.replace('_', ' ')}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar