import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { PROGRAM_LIST } from '@/lib/syllabus'
import { upsertProfile } from '@/context/AuthContext'
import type { BoardProgramKey } from '@/types'
import { Button, Input, Select, Icon, useToast } from '@/components/ui'

export default function RegisterPage() {
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [program, setProgram] = useState<BoardProgramKey>('criminology')
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
        await upsertProfile(user.id, program, fullName)
      } catch (err: any) {
        console.warn('Profile upsert deferred:', err?.message)
      }
    }
    setLoading(false)
    if (data.session) nav('/dashboard')
    else nav('/login')
  }

  const selectedProgram = PROGRAM_LIST.find((p) => p.key === program)

  return (
    <div className="auth-form-page auth-form-page--register">
      <div className="auth-form-heading">
        <span className="section-kicker">
          <span className="eyebrow-dot" /> LET'S GET STARTED
        </span>
        <h1>
          Make space
          <br />
          for <em>what's next.</em>
        </h1>
        <p>Create your account and make your review feel a little more manageable.</p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <Icon name="alert-circle" size={19} />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="auth-form">
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
          <Select
            label="PRC board program"
            value={program}
            onChange={(e) => setProgram(e.target.value as BoardProgramKey)}
            options={PROGRAM_LIST.map((p) => ({ value: p.key, label: p.name }))}
            leftIcon="flag"
            fullWidth
          />
          <p className="auth-field-hint">{selectedProgram?.description}</p>
        </div>
        <Button
          variant="primary"
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          rightIcon="arrow-right"
          className="auth-submit"
        >
          {loading ? 'Creating account…' : 'Create your account'}
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
