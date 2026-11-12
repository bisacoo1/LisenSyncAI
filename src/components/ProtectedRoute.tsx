import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children, requireProfile = true }: { children: JSX.Element; requireProfile?: boolean }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="container"><div className="card">Loading...</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (requireProfile && !profile) return <Navigate to="/onboarding" replace />
  return children
}

export function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="container"><div className="card">Loading...</div></div>
  if (user && profile) return <Navigate to="/dashboard" replace />
  if (user && !profile) return <Navigate to="/onboarding" replace />
  return children
}
