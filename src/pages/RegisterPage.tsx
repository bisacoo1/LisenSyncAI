import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { PROGRAM_LIST } from '@/lib/syllabus'
import { upsertProfile } from '@/context/AuthContext'
import type { BoardProgramKey } from '@/types'

export default function RegisterPage() {
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [program, setProgram] = useState<BoardProgramKey>('criminology')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) { setError('Supabase is not configured. Copy .env.example to .env and set your project keys.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setLoading(false); setError(error.message); return }
    const user = data.user
    if (user) {
      try {
        await upsertProfile(user.id, program, fullName)
      } catch (err: any) {
        // If email confirmation is required, profile insert may need a session; user can complete onboarding after confirm.
        console.warn('Profile upsert deferred:', err?.message)
      }
    }
    setLoading(false)
    if (data.session) nav('/dashboard')
    else nav('/login')
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h1 className="section-title">Create your account</h1>
        <p className="muted">Board Program Onboarding: select your licensure course so subjects, AI prompts, and analytics align with your official board syllabus.</p>
        {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field"><label>Full name</label><input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
          <div className="field">
            <label>PRC Board Program</label>
            <select value={program} onChange={e => setProgram(e.target.value as BoardProgramKey)}>
              {PROGRAM_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <small className="muted">{PROGRAM_LIST.find(p => p.key === program)?.description}</small>
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Register'}</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  )
}
