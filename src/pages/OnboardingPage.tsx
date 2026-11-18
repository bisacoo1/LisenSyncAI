import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, upsertProfile } from '@/context/AuthContext'
import { DEFAULT_PROGRAM, PHARMACY_PROGRAM } from '@/lib/syllabus'
import { PASSING_RATE, type StudyTrack } from '@/types'
import { Card, CardHeader, CardContent, Button, Input, Icon, useToast } from '@/components/ui'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '')
  const [track, setTrack] = useState<StudyTrack>(profile?.track || (user?.user_metadata?.track === 'course' ? 'course' : 'board'))
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
      await upsertProfile(user.id, DEFAULT_PROGRAM, fullName, examDate || null, track)
      await refreshProfile()
      addToast({ type: 'success', title: 'Profile saved', message: 'Welcome to your BS Pharmacy study space!' })
      nav('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
      addToast({ type: 'error', title: 'Save failed', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-page">
      <header className="workspace-page-header">
        <div>
          <div className="section-kicker">
            <span className="eyebrow-dot" /> {track === 'course' ? 'BS PHARMACY · COURSE MODE SETUP' : 'BS PHARMACY · PhLE SETUP'} <span>/ 00</span>
          </div>
          <h1>
            {track === 'course' ? <>Let's set up <em>your course plan.</em></> : <>Let's set up <em>your PhLE plan.</em></>}
          </h1>
          <p>
            {track === 'course'
              ? 'Still taking BS Pharmacy? Upload your course reviewers and we will build flashcards and drills around the subjects you name.'
              : 'Personalize your Pharmacy review profile. Your reviewers, practice drills, mock exams, and analytics are automatically aligned to all 6 PRC Pharmacist Licensure Examination modules.'}
          </p>
        </div>
      </header>
      <Card variant="elevated">
        <CardHeader
          title="Your Pharmacy review profile"
          icon="pill"
          subtitle="You can set a target PhLE date now or update it later from your dashboard."
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

          <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {track === 'board' && (
              <>
            <div className="pharmacy-program-banner" aria-label="Pharmacy licensure program syllabus">
              <span className="pharmacy-program-banner-icon">
                <Icon name="flask" size={18} />
              </span>
              <div className="pharmacy-program-banner-copy">
                <span className="pharmacy-program-banner-kicker">PRC BOARD PROGRAM</span>
                <strong>{PHARMACY_PROGRAM.name}</strong>
                <span>
                  {PHARMACY_PROGRAM.subjects.length} official modules · {PHARMACY_PROGRAM.mockDurationMinutes}-min mock
                  · {PASSING_RATE}% passing mark
                </span>
              </div>
            </div>

            <div className="pharmacy-module-grid" aria-label="Included PhLE modules">
              {PHARMACY_PROGRAM.subjectDetails.map((mod) => (
                <div className="pharmacy-module-chip" key={mod.name}>
                  <span className="pharmacy-module-chip-icon">
                    <Icon name={mod.icon} size={14} />
                  </span>
                  <div className="pharmacy-module-chip-text">
                    <span>
                      {mod.moduleCode} · {mod.weightPercent}%
                    </span>
                    <strong>{mod.name}</strong>
                  </div>
                </div>
              ))}
            </div>
              </>
            )}

            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              leftIcon="user"
              fullWidth
            />

            <div>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>HOW ARE YOU PREPARING?</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {([
                  { value: 'board' as StudyTrack, title: 'Board exam review', desc: 'Taking the Pharmacists Licensure Examination — official PhLE modules, TOS mock exam, 75% + 50% rule.' },
                  { value: 'course' as StudyTrack, title: 'Still studying', desc: 'Currently taking BS Pharmacy — create your own subjects from your uploaded reviewers.' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTrack(opt.value)}
                    aria-pressed={track === opt.value}
                    style={{
                      textAlign: 'left', padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${track === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                      background: track === opt.value ? 'var(--primary-bg)' : 'var(--panel-2)',
                      color: 'var(--text)', transition: 'all 150ms ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Icon name={opt.value === 'board' ? 'flag' : 'book-open'} size={16} style={{ color: track === opt.value ? 'var(--primary)' : 'var(--muted)' }} />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {track === 'board' && (
              <>
                <Input
                  label="Target PhLE exam date (optional)"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  leftIcon="calendar"
                  fullWidth
                />
                <p style={{ marginTop: -10, fontSize: 12, color: 'var(--muted)' }}>
                  We'll show a countdown on your dashboard to keep your Pharmacy review on track.
                </p>
              </>
            )}

            <Button variant="primary" type="submit" fullWidth size="lg" loading={saving} style={{ marginTop: 4 }}>
              {saving ? 'Saving…' : 'Save and enter Pharmacy workspace'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
