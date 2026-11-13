import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { PROGRAM_LIST } from '@/lib/syllabus'
import { upsertProfile } from '@/context/AuthContext'
import type { BoardProgramKey } from '@/types'
import { AuthLayout } from '@/components/Layout'
import { Card, CardHeader, CardContent, Button, Input, Select, Icon, Badge, useToast } from '@/components/ui'
import logo from '@/logo/logo.png'

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
    if (!supabaseConfigured) { setError('Supabase is not configured. Copy .env.example to .env and set your project keys.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setLoading(false); setError(error.message); addToast({ type: 'error', title: 'Registration failed', message: error.message }); return }
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

  const selectedProgram = PROGRAM_LIST.find(p => p.key === program)

  return (
    <AuthLayout>
      {/* Brand header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{ width: 112, height: 112, borderRadius: 28, background: 'var(--panel-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={logo} alt="LisenSync AI logo" style={{ width: 56, height: 56 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>LisenSync AI</h1>
          <p style={{ margin: '8px 0 0', fontSize: 17, color: 'var(--muted)' }}>PRC Licensure Exam Reviewer</p>
        </div>
      </div>

      <Card variant="elevated">
        <CardHeader title="Create your account" subtitle="Select your licensure course so subjects, AI prompts, and analytics align with your official board syllabus." style={{ textAlign: 'center', borderBottom: 'none', paddingBottom: 8 }} />
        <CardContent style={{ paddingTop: 0 }}>
          {error && (
            <div role="alert" style={{ marginBottom: 20, padding: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="alert-circle" size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              leftIcon="user"
              fullWidth
            />
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
                minLength={6}
                leftIcon="lock"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                }
                placeholder="••••••••"
                fullWidth
              />
            </div>

            <div>
              <Select
                label="PRC Board Program"
                value={program}
                onChange={e => setProgram(e.target.value as BoardProgramKey)}
                options={PROGRAM_LIST.map(p => ({ value: p.key, label: p.name }))}
                leftIcon="flag"
                fullWidth
              />
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{selectedProgram?.description}</p>
            </div>

            <Button variant="primary" type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: 8 }}>
              {loading ? 'Creating…' : 'Register'}
            </Button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>Sign in</Link>
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <div style={{ marginTop: 32, textAlign: 'center', color: 'var(--muted-strong)', fontSize: 13 }}>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} LisenSync AI. All rights reserved.</p>
      </div>
    </AuthLayout>
  )
}
