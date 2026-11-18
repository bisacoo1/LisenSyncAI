import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children, requireProfile = true }: { children: JSX.Element; requireProfile?: boolean }) {
  const { user, profile, loading, profileError, refreshProfile } = useAuth()
  if (loading) return <div className="container"><div className="card">Loading...</div></div>
  if (!user) return <Navigate to="/login" replace />
  if (profileError) return <div className="container workspace-page" role="alert"><div className="dashboard-load-error"><div><strong>Could not load your profile</strong><p>{profileError}</p><button className="ui-button ui-button--primary ui-button--md" onClick={() => { void refreshProfile().catch(() => {}) }}>Try again</button></div></div></div>
  if (requireProfile && !profile) return <Navigate to="/onboarding" replace />
  return children
}

export function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, profile, loading, profileError, refreshProfile } = useAuth()
  if (loading) return <div className="container"><div className="card">Loading...</div></div>
  if (user && profileError) return <div role="alert">Could not load your profile. <button type="button" onClick={() => { void refreshProfile().catch(() => {}) }}>Try again</button></div>
  if (user && profile) return <Navigate to="/dashboard" replace />
  if (user && !profile) return <Navigate to="/onboarding" replace />
  return children
}
