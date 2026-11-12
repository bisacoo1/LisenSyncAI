import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type Profile } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, ProgressBar, Icon, EmptyState, Skeleton } from '@/components/ui'

export default function DashboardPage() {
  const { profile } = useAuth()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase.from('attempts').select('*').eq('user_id', profile.id).limit(500)
      setAttempts((data as Attempt[]) || [])
      setLoading(false)
    })()
  }, [profile])

  if (!profile || !program) return null

  const overall = overallPercent(attempts)
  const readiness = readinessLabel(overall)
  const weak = computeSubjectStats(attempts, program.subjects).filter(s => s.weak && s.total > 0)
  const subjectStats = computeSubjectStats(attempts, program.subjects)

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      {/* Hero Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>{program.name}</p>
          </div>
          <Badge variant={readiness.tone === 'ok' ? 'success' : readiness.tone === 'warn' ? 'warning' : 'danger'} size="lg">
            <Icon name={readiness.tone === 'ok' ? 'check-circle' : readiness.tone === 'warn' ? 'alert-triangle' : 'alert-circle'} size={14} />
            Readiness: {overall}% — {readiness.label}
          </Badge>
        </div>

        {/* Progress toward 75% */}
        <Card variant="elevated" style={{ background: 'linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)', border: '1px solid var(--border)' }}>
          <CardContent>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 700, color: overall >= PASSING_RATE ? 'var(--success)' : overall >= 60 ? 'var(--warning)' : 'var(--danger)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                    {overall}%
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>Overall Score</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Target: <strong style={{ color: 'var(--text)' }}>{PASSING_RATE}%</strong> to pass PRC licensure</span>
                  {overall < PASSING_RATE && (
                    <span style={{ fontSize: 13, color: 'var(--warning)' }}>
                      {PASSING_RATE - overall}% to go
                    </span>
                  )}
                </div>
                <ProgressBar value={overall} max={100} size="lg" variant={overall >= PASSING_RATE ? 'success' : overall >= 60 ? 'warning' : 'danger'} animated striped />
              </div>
              <div style={{ textAlign: 'right', minWidth: 140 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>ATTEMPTS TRACKED</div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>{loading ? '—' : attempts.length}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>SUBJECTS IN PROGRAM</div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>{program.subjects.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gamification: XP, Level, Streak, Daily Goal */}
        <Card variant="elevated">
          <CardHeader title="Study Progress" icon="trophy" subtitle="Earn XP, level up, and keep your streak alive" />
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--panel-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>{profile.level || 1}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(profile.xp || 0)} XP total</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--panel-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Streak</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>{profile.current_streak || 0} 🔥</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Best: {profile.longest_streak || 0} days</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--panel-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Goal</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
                  {profile.daily_items_completed || 0} / {profile.daily_goal || 20}
                </div>
                <ProgressBar
                  value={Math.min(100, (((profile.daily_items_completed || 0) / Math.max(profile.daily_goal || 20)) * 100))}
                  max={100}
                  size="sm"
                  variant={(profile.daily_items_completed || 0) >= (profile.daily_goal || 20) ? 'success' : 'primary'}
                  style={{ marginTop: 8 }}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {(profile.daily_items_completed || 0) >= (profile.daily_goal || 20) ? 'Goal reached! 🎉' : `${Math.max(0, (profile.daily_goal || 20) - (profile.daily_items_completed || 0))} items left`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <Card variant="outlined" hoverable>
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'var(--primary-bg)', color: 'var(--primary)', flexShrink: 0 }}>
              <Icon name="book-open" size={24} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>BOARD SUBJECTS</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{program.subjects.length}</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Aligned to official PRC syllabus</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined" hoverable>
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'var(--success-bg)', color: 'var(--success)', flexShrink: 0 }}>
              <Icon name="target" size={24} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>PASSING BENCHMARK</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{PASSING_RATE}%</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>PRC licensure passing mark</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined" hoverable>
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'var(--warning-bg)', color: 'var(--warning)', flexShrink: 0 }}>
              <Icon name="timer" size={24} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>MOCK DURATION</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{program.mockDurationMinutes} min</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Full timed simulation available</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Quick Actions */}
        <Card variant="elevated">
          <CardHeader title="Quick Actions" icon="zap" subtitle="Jump straight into your study flow" />
          <CardContent>
            <div style={{ display: 'grid', gap: 10 }}>
              <Link to="/reviewer" style={{ textDecoration: 'none' }}>
                <Button variant="primary" fullWidth leftIcon="file-text" rightIcon="chevron-right" size="lg">
                  Upload Reviewer & Generate Drills
                </Button>
              </Link>
              <Link to="/practice" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" fullWidth leftIcon="brain" rightIcon="chevron-right" size="lg">
                  Practice (MCQ / Diagnosis / Sequence)
                </Button>
              </Link>
              <Link to="/mock" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" fullWidth leftIcon="timer" rightIcon="chevron-right" size="lg">
                  Start Timed Mock Simulation
                </Button>
              </Link>
              <Link to="/analytics" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" fullWidth leftIcon="bar-chart" rightIcon="chevron-right" size="lg">
                  View Readiness Analytics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Weak Topics & Subjects */}
        <Card variant="elevated">
          <CardHeader title="Focus Areas" icon="alert-triangle" subtitle="Subjects needing remediation toward 75%" />
          <CardContent>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="text" width="60%" />)}
              </div>
            ) : weak.length === 0 ? (
              <EmptyState
                icon="check-circle"
                title="No weak topics flagged"
                description="Complete practice sessions or a mock exam to generate targeted remediation insights."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {weak.map(w => (
                  <div key={w.subject} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--panel-2)', borderRadius: 10, border: '1px solid var(--danger-border)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{w.subject}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{w.percent}% ({w.correct}/{w.total}) — Needs targeted remediation</div>
                    </div>
                    <ProgressBar value={w.percent} max={100} size="sm" variant="danger" style={{ width: 120 }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontWeight: 500 }}>YOUR BOARD SUBJECTS</div>
              <div className="pill-list">
                {program.subjects.map(s => {
                  const stat = subjectStats.find(st => st.subject === s)
                  const isWeak = stat && stat.weak && stat.total > 0
                  return (
                    <Badge
                      key={s}
                      variant={isWeak ? 'danger' : stat && stat.total > 0 ? 'success' : 'default'}
                      size="sm"
                      dot={!!stat && stat.total > 0}
                    >
                      {s}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Subject Performance Overview */}
      <Card variant="outlined">
        <CardHeader title="Per-Subject Performance" icon="bar-chart" subtitle="Track your mastery across all board subjects" />
        <CardContent>
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th style={{ width: 100 }}>Correct</th>
                  <th style={{ width: 100 }}>Total</th>
                  <th style={{ minWidth: 200 }}>Score</th>
                  <th style={{ width: 160 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subjectStats.map(s => (
                  <tr key={s.subject}>
                    <td style={{ fontWeight: 500 }}>{s.subject}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.correct}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{s.total}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ProgressBar value={s.percent} max={100} size="sm" variant={s.percent >= PASSING_RATE ? 'success' : s.percent >= 60 ? 'warning' : 'danger'} style={{ flex: 1, minWidth: 120 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 45, color: s.percent >= PASSING_RATE ? 'var(--success)' : s.percent >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{s.percent}%</span>
                      </div>
                    </td>
                    <td>
                      {s.total === 0 ? (
                        <Badge variant="default" size="sm">No data</Badge>
                      ) : (
                        <Badge variant={s.weak ? 'danger' : 'success'} size="sm" dot>
                          {s.weak ? 'Needs remediation' : 'On track'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}