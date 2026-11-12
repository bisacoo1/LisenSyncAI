import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) { setError('Supabase is not configured. Copy .env.example to .env and set your project keys.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else nav('/dashboard')
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <h1 className="section-title">Sign in</h1>
        <p className="muted">Access your PRC licensure reviewer and mock assessments.</p>
        {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  )
}
