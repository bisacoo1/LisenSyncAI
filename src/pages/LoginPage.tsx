import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { AuthLayout } from '@/components/Layout'
import { Card, CardHeader, CardContent, Button, Input, Icon, useToast } from '@/components/ui'

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
    if (!supabaseConfigured) { setError('Supabase is not configured. Copy .env.example to .env and set your project keys.'); return }
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
    <AuthLayout>
      <Card variant="elevated">
        <CardHeader title="Welcome back" subtitle="Sign in to access your PRC licensure reviewer" style={{ textAlign: 'center', borderBottom: 'none', paddingBottom: 8 }} />
        <CardContent style={{ paddingTop: 0 }}>
          {error && (
            <div style={{ marginBottom: 20, padding: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="alert-circle" size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              leftIcon="mail"
              placeholder="you@example.com"
              fullWidth
            />
            <div style={{ position: 'relative' }}>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                leftIcon="lock"
                rightIcon={showPassword ? 'eye-off' : 'eye'}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                }
                placeholder="••••••••"
                fullWidth
              />
            </div>

            <Button variant="primary" type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: 8 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            No account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 500 }}>Create one</Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}