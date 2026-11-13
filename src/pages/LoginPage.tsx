import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button, Input, Icon, useToast } from '@/components/ui'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      addToast({ type: 'error', title: 'Sign in failed', message: error.message })
    } else {
      nav('/dashboard')
    }
  }

  return (
    <div className="auth-form-page">
      <div className="auth-form-heading">
        <span className="section-kicker">
          <span className="eyebrow-dot" /> WELCOME BACK
        </span>
        <h1>
          Pick up where
          <br />
          <em>you left off.</em>
        </h1>
        <p>Your study space is ready when you are.</p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <Icon name="alert-circle" size={19} />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="auth-form">
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          leftIcon="lock"
          placeholder="Enter your password"
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
        <Button
          variant="primary"
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          rightIcon="arrow-right"
          className="auth-submit"
        >
          {loading ? 'Signing in…' : 'Sign in to your workspace'}
        </Button>
      </form>
      <div className="auth-form-bottom">
        New to LisenSync?{' '}
        <Link to="/register">
          Create an account <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </div>
  )
}
