import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, upsertProfile } from '@/context/AuthContext'
import { PROGRAM_LIST } from '@/lib/syllabus'
import type { BoardProgramKey } from '@/types'
import { Card, CardHeader, CardContent, Button, Input, Select, Icon, useToast } from '@/components/ui'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [program, setProgram] = useState<BoardProgramKey>((profile?.board_program as BoardProgramKey) || 'criminology')
  const [examDate, setExamDate] = useState(profile?.target_exam_date || '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)
    try {
      await upsertProfile(user.id, program, fullName, examDate || null)
      await refreshProfile()
      addToast({ type: 'success', title: 'Profile saved', message: 'Welcome to LisenSync AI!' })
      nav('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
      addToast({ type: 'error', title: 'Save failed', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const selectedProgram = PROGRAM_LIST.find((p) => p.key === program)

  return (
    <div className="onboarding-page">
      <header className="workspace-page-header">
        <div>
          <div className="section-kicker">
            <span className="eyebrow-dot" /> A SPACE THAT'S YOURS <span>/ 00</span>
          </div>
          <h1>
            Let's set <em>your path.</em>
          </h1>
          <p>Choose your board program and we'll bring your subjects, practice, and progress together in one place.</p>
        </div>
      </header>
      <Card variant="elevated">
        <CardHeader
          title="Your review profile"
          icon="flag"
          subtitle="You can set a target exam date now or add one later."
        />
        <CardContent style={{ paddingTop: 0 }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: 20,
                padding: 12,
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 10,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <Icon name="alert-circle" size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              leftIcon="user"
              fullWidth
            />

            <div>
              <Select
                label="PRC Board Program"
                value={program}
                onChange={(e) => setProgram(e.target.value as BoardProgramKey)}
                options={PROGRAM_LIST.map((p) => ({ value: p.key, label: p.name }))}
                leftIcon="flag"
                fullWidth
              />
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{selectedProgram?.description}</p>
            </div>

            <Input
              label="Target exam date (optional)"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              leftIcon="calendar"
              fullWidth
            />
            <p style={{ marginTop: -8, fontSize: 12, color: 'var(--muted)' }}>
              We'll show a countdown on your dashboard to keep you on track.
            </p>

            <Button variant="primary" type="submit" fullWidth size="lg" loading={saving} style={{ marginTop: 8 }}>
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
