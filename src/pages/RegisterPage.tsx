import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { DEFAULT_PROGRAM, PHARMACY_PROGRAM } from '@/lib/syllabus'
import { upsertProfile } from '@/context/AuthContext'
import { PASSING_RATE, type StudyTrack } from '@/types'
import { Button, Input, Icon, useToast } from '@/components/ui'

export default function RegisterPage() {
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [track, setTrack] = useState<StudyTrack>('board')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) {
      setError('Supabase is not configured. Copy .env.example to .env and set your project keys.')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      addToast({ type: 'error', title: 'Registration failed', message: error.message })
      return
    }
    const user = data.user
    if (user) {
      try {
        await upsertProfile(user.id, DEFAULT_PROGRAM, fullName, null, track)
      } catch (err: any) {
        console.warn('Profile upsert deferred:', err?.message)
      }
    }
    setLoading(false)
    if (data.session) nav('/dashboard')
    else nav('/login')
  }

  return (
    <div className="auth-form-page auth-form-page--register">
      <div className="auth-form-heading">
        <span className="section-kicker">
          <span className="eyebrow-dot" /> BS PHARMACY · PhLE REVIEW
        </span>
        <h1>
          Make space
          <br />
          for <em>your RPh.</em>
        </h1>
        <p>Create your Pharmacy study account and organize your review across all 6 PRC board modules.</p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <Icon name="alert-circle" size={19} />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="pharmacy-program-banner" aria-label="Selected board exam track">
          <span className="pharmacy-program-banner-icon">
            <Icon name="pill" size={18} />
          </span>
          <div className="pharmacy-program-banner-copy">
            <span className="pharmacy-program-banner-kicker">INCLUDED BOARD TRACK</span>
            <strong>{PHARMACY_PROGRAM.name}</strong>
            <span>
              {PHARMACY_PROGRAM.subjects.length} official PRC PhLE modules · {PASSING_RATE}% passing benchmark
            </span>
          </div>
        </div>
        <Input
          label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Juan Dela Cruz"
          leftIcon="user"
          fullWidth
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          leftIcon="mail"
          placeholder="you@example.com"
          fullWidth
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          leftIcon="lock"
          placeholder="At least 6 characters"
          fullWidth
          rightElement={
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          }
        />
        <div>
          <span className="auth-field-hint" style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>How are you preparing?</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { value: 'board' as StudyTrack, title: 'Board exam', desc: 'PhLE candidate' },
              { value: 'course' as StudyTrack, title: 'Still studying', desc: 'BS Pharmacy student' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTrack(opt.value)}
                aria-pressed={track === opt.value}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${track === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: track === opt.value ? 'var(--primary-bg)' : 'var(--panel-2)',
                  color: 'var(--text)', transition: 'all 150ms ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <p className="auth-field-hint" style={{ marginTop: -4 }}>For BS Pharmacy — the Pharmacists Licensure Examination (PhLE) or your current coursework.</p>
        <Button
          variant="primary"
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          rightIcon="arrow-right"
          className="auth-submit"
        >
          {loading ? 'Creating account…' : 'Create Pharmacy account'}
        </Button>
      </form>
      <div className="auth-form-bottom">
        Already have an account?{' '}
        <Link to="/login">
          Sign in <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </div>
  )
}
