import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button, Input, Icon } from '@/components/ui'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) {
      setError(
        'Sign-in is not available yet. Please contact the site administrator to finish setting up authentication.'
      )
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) setError(error.message)
      else nav('/dashboard')
    } catch {
      setError(
        'We couldn’t connect. Check your internet connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form-page">
      <div className="auth-form-heading">
        <span className="public-auth-form-icon">
          <Icon name="book-open" size={22} />
        </span>
        <h1>Good to see you again.</h1>
        <p>
          A little progress starts with showing up. Let’s pick up where you left
          off.
        </p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <Icon name="alert-circle" size={19} />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="auth-form" aria-busy={loading}>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
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
          disabled={loading}
          leftIcon="lock"
          placeholder="Enter your password"
          fullWidth
          rightElement={
            <button
              type="button"
              disabled={loading}
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
          {loading ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
      <div className="auth-form-bottom">
        Your pharmacy journey starts here.{' '}
        <Link to="/register">
          Create an account <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </div>
  )
}
