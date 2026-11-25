import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { DEFAULT_PROGRAM } from '@/lib/syllabus'
import { upsertProfile, useAuth } from '@/context/AuthContext'
import type { StudyTrack } from '@/types'
import { StudyTrackSelector } from '@/components/StudyTrackSelector'
import { Button, Input, Icon, useToast } from '@/components/ui'

export default function RegisterPage() {
  const nav = useNavigate()
  const { refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Respect the study mode the visitor picked on the landing page (?track=course).
  const [track, setTrack] = useState<StudyTrack>(
    searchParams.get('track') === 'course' ? 'course' : 'board'
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) {
      setError(
        'Account creation is not available yet. Please contact the site administrator to finish setting up authentication.'
      )
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName, track } },
      })
      if (error) {
        setError(error.message)
        return
      }
      const user = data.user
      if (user && data.session) {
        try {
          await upsertProfile(user.id, DEFAULT_PROGRAM, fullName, null, track)
          await refreshProfile(user.id)
        } catch (err: any) {
          console.warn('Profile upsert deferred:', err?.message)
        }
      }
      if (data.session) nav('/dashboard')
      else {
        addToast({
          type: 'info',
          title: 'Check your email',
          message: 'Confirm your account before signing in.',
        })
        nav('/login')
      }
    } catch {
      setError(
        'We couldn’t connect. Check your internet connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form-page auth-form-page--register">
      <div className="auth-form-heading">
        <span className="public-auth-form-icon">
          <Icon name="sparkles" size={22} />
        </span>
        <h1>Your next chapter starts here.</h1>
        <p>
          Make room for better study days. Create your Pharmora account and find
          your rhythm.
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
          label="Full name"
          autoComplete="name"
          maxLength={100}
          disabled={loading}
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
          disabled={loading}
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
          disabled={loading}
          minLength={6}
          hint="Use at least 6 characters. A longer password is more secure."
          leftIcon="lock"
          placeholder="At least 6 characters"
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
        <StudyTrackSelector
          value={track}
          onChange={setTrack}
          options={[
            {
              value: 'board',
              title: 'Board exam',
              description: 'PhLE candidate',
            },
            {
              value: 'course',
              title: 'Still studying',
              description: 'BS Pharmacy student',
            },
          ]}
        />
        <p className="auth-field-hint">
          {track === 'board'
            ? 'Review across all 6 PhLE modules with practice and timed mock exams.'
            : 'Organize your own subjects and turn your course notes into practice.'}
        </p>
        <Button
          variant="primary"
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          rightIcon="arrow-right"
          className="auth-submit"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <div className="auth-form-bottom">
        Already have an account?{' '}
        <Link to="/login">
          Log in <Icon name="arrow-right" size={15} />
        </Link>
      </div>
    </div>
  )
}
