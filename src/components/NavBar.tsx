import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function NavBar() {
  const { user, profile, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <nav className="nav">
      <div className="links">
        <Link to="/" className="brand">LisenSync AI</Link>
        {user && profile && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/reviewer">Reviewer & Generate</Link>
            <Link to="/practice">Practice</Link>
            <Link to="/mock">Mock Exam</Link>
            <Link to="/analytics">Analytics</Link>
          </>
        )}
      </div>
      <div className="links">
        {user ? (
          <>
            {profile && <span className="badge">{profile.board_program.replace('_', ' ')}</span>}
            <button className="btn secondary" onClick={async () => { await signOut(); nav('/login') }}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}
