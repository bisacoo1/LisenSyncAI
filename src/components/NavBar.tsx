import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button, Icon, Badge } from '@/components/ui'

export function NavBar() {
  const { user, profile, signOut } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/reviewer', label: 'Reviewer', icon: 'reviewer' },
    { path: '/practice', label: 'Practice', icon: 'practice' },
    { path: '/mock', label: 'Mock Exam', icon: 'mock' },
    { path: '/analytics', label: 'Analytics', icon: 'analytics' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="links" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/" className="brand" aria-label="LisenSync AI Home">
          <Icon name="logo" size={28} style={{ color: 'var(--primary)' }} />
          <span>LisenSync AI</span>
        </Link>
        <div style={{ width: 1, height: 24, background: 'var(--border)', marginLeft: 8, marginRight: 4 }} />
        {user && profile && (
          <>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive(item.path) ? 'var(--primary)' : 'var(--muted)',
                  borderRadius: '8px',
                  transition: 'all 150ms ease',
                  textDecoration: 'none',
                  background: isActive(item.path) ? 'var(--primary-bg)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.color = 'var(--primary)'
                    e.currentTarget.style.background = 'var(--primary-bg)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.color = 'var(--muted)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon name={item.icon as any} size={16} />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </div>
      <div className="links" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            {profile && (
              <Badge variant="primary" size="sm" style={{ fontWeight: 500 }}>
                <Icon name="flag" size={11} />
                {profile.board_program.replace('_', ' ')}
              </Badge>
            )}
            <Button variant="ghost" size="sm" leftIcon="logout" onClick={async () => { await signOut(); nav('/login') }}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '13px', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>
              <Button variant="ghost" size="sm" leftIcon="login">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" leftIcon="user">Get Started</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default NavBar