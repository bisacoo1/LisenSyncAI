import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type MockExam, type PracticeItem } from '@/types'
import { Card, CardHeader, CardContent, Badge, Icon, ProgressBar, CircularProgress, EmptyState, Skeleton } from '@/components/ui'

export default function AnalyticsPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [exams, setExams] = useState<MockExam[]>([])
  const [weakDrills, setWeakDrills] = useState<PracticeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data: a } = await supabase.from('attempts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1000)
      const { data: e } = await supabase.from('mock_exams').select('*').eq('user_id', profile.id).order('started_at', { ascending: false }).limit(20)
      const atts = (a as Attempt[]) || []
      setAttempts(atts)
      setExams((e as MockExam[]) || [])
      setLoading(false)
    })()
  }, [profile?.id])

  const stats = useMemo(() => program ? computeSubjectStats(attempts, program.subjects) : [], [attempts, program])
  const overall = useMemo(() => overallPercent(attempts), [attempts])
  const readiness = readinessLabel(overall)
  const weakSubjects = stats.filter(s => s.weak)

  const trend = useMemo(() => {
    const byDay: Record<string, { correct: number; total: number }> = {}
    for (const a of attempts) {
      const d = (a.created_at || '').slice(0, 10)
      if (!d) continue
      byDay[d] = byDay[d] || { correct: 0, total: 0 }
      byDay[d].total += 1
      if (a.is_correct) byDay[d].correct += 1
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, percent: Math.round((v.correct / v.total) * 100), total: v.total }))
  }, [attempts])

  useEffect(() => {
    if (!profile || !weakSubjects.length) { setWeakDrills([]); return }
    ;(async () => {
      const names = weakSubjects.map(s => s.subject)
      const { data } = await supabase.from('practice_items').select('*').eq('user_id', profile!.id).in('subject', names).in('type', ['mcq', 'diagnosis', 'sequence']).limit(12)
      setWeakDrills((data as PracticeItem[]) || [])
    })()
  }, [profile, weakSubjects.map(s => s.subject).join('|')])

  if (!profile || !program) return null

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700 }}>Readiness Analytics</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>Scores per board exam subject, weak-topic flags, and targeted remediation drills toward the {PASSING_RATE}% passing mark.</p>
        </div>
        <Badge variant={readiness.tone === 'ok' ? 'success' : readiness.tone === 'warn' ? 'warning' : 'danger'} size="lg">
          <Icon name={readiness.tone === 'ok' ? 'check-circle' : readiness.tone === 'warn' ? 'alert-triangle' : 'alert-circle'} size={14} />
          Overall: {overall}% — {readiness.label}
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: 'var(--primary-bg)', color: 'var(--primary)', flexShrink: 0 }}>
              <Icon name="target" size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>OVERALL SCORE</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: overall >= PASSING_RATE ? 'var(--success)' : overall >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{overall}%</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Across {attempts.length} recorded attempts</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: 'var(--success-bg)', color: 'var(--success)', flexShrink: 0 }}>
              <Icon name="flag" size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>TARGET BENCHMARK</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--success)' }}>{PASSING_RATE}%</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>PRC licensure passing mark</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: weakSubjects.length > 0 ? 'var(--danger-bg)' : 'var(--success-bg)', color: weakSubjects.length > 0 ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }}>
              <Icon name={weakSubjects.length > 0 ? 'alert-triangle' : 'check-circle'} size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>WEAK SUBJECTS</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: weakSubjects.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{weakSubjects.length}</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{weakSubjects.length > 0 ? 'Subjects below 75% or no attempts' : 'All subjects on track'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Subject Performance */}
      <Card variant="outlined" style={{ marginBottom: 24 }}>
        <CardHeader title="Per-Subject Performance" icon="bar-chart" subtitle={`${program.name} • ${stats.length} subjects tracked`} />
        <CardContent>
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th style={{width: 100}}>Correct</th>
                  <th style={{width: 100}}>Total</th>
                  <th style={{minWidth: 240}}>Score</th>
                  <th style={{width: 180}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.subject}>
                    <td style={{ fontWeight: 500 }}>{s.subject}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.correct}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{s.total}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ProgressBar value={s.percent} max={100} size="sm" variant={s.percent >= PASSING_RATE ? 'success' : s.percent >= 60 ? 'warning' : 'danger'} style={{ flex: 1, minWidth: 150 }} />
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

      {/* Remediation & Mock History */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Targeted Remediation */}
        <Card variant="elevated">
          <CardHeader title="Targeted Remediation Drills" icon="brain" subtitle="Focus on these subjects to reach 75%" />
          <CardContent>
            {weakSubjects.length === 0 ? (
              <EmptyState
                icon="check-circle"
                title="No weak subjects flagged"
                description="Maintain performance with continued timed mock simulations."
              />
            ) : (
              <>
                <div className="pill-list" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                  {weakSubjects.map(s => (
                    <Badge key={s.subject} variant="danger" size="sm" dot>
                      {s.subject} — {s.percent}%
                    </Badge>
                  ))}
                </div>
                {weakDrills.length === 0 ? (
                  <div style={{ padding: 20, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10, color: 'var(--warning)' }}>
                    <Icon name="alert-triangle" size={20} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>No remediation drills found yet</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Generate more items in <strong>Reviewer & Generate</strong> for these subjects.</div>
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weakDrills.map(d => (
                      <li key={d.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Badge variant="primary" size="sm" style={{ flexShrink: 0 }}>{d.subject}</Badge>
                        <Badge variant={d.type === 'mcq' ? 'info' : d.type === 'diagnosis' ? 'warning' : 'success'} size="sm" style={{ flexShrink: 0 }}>{d.type.toUpperCase()}</Badge>
                        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
                          {(d.question as any)?.stem || (d.question as any)?.prompt || (d.question as any)?.scenario?.slice(0, 100) || 'Practice item available in Practice mode'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Mock Exam History */}
        <Card variant="elevated">
          <CardHeader title="Mock Exam History" icon="timer" subtitle={`${exams.length} exam${exams.length !== 1 ? 's' : ''} completed`} />
          <CardContent>
            {exams.length === 0 ? (
              <EmptyState
                icon="timer"
                title="No mock exams yet"
                description="Start a timed simulation to track your exam readiness."
                action={{ label: 'Start Mock Exam', onClick: () => navigate('/mock'), variant: 'primary' }}
              />
            ) : (
              <div className="table-wrapper">
                <table className="table" style={{ minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{width: 80}}>Items</th>
                      <th style={{width: 100}}>Score</th>
                      <th style={{width: 140}}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map(e => (
                      <tr key={e.id}>
                        <td className="muted" style={{ fontSize: 13 }}>{new Date(e.started_at).toLocaleDateString()}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.total_items}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: e.score != null && e.score >= PASSING_RATE ? 'var(--success)' : e.score != null ? 'var(--danger)' : 'var(--muted)' }}>
                          {e.score != null ? `${e.score}%` : '—'}
                        </td>
                        <td>
                          {e.status === 'submitted' ? (
                            <Badge variant={e.passed ? 'success' : 'danger'} size="sm" dot>
                              {e.passed ? 'Passed' : 'Below 75%'}
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm" dot>In progress</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Readiness Trend */}
      <Card variant="outlined">
        <CardHeader title="Readiness Trend" icon="trending-up" subtitle="Daily accuracy across all practice and mock attempts" />
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState
              icon="trending-up"
              title="No activity yet"
              description="Complete practice questions or a mock exam to start tracking your readiness over time."
            />
          ) : trend.length === 1 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="trending-up" size={40} style={{ color: 'var(--muted)', marginBottom: 12, opacity: 0.6 }} />
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {trend[0].percent}% on {new Date(trend[0].date).toLocaleDateString()} ({trend[0].total} items) — check back after more sessions to see your trend.
              </p>
            </div>
          ) : (
            <TrendChart data={trend} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TrendChart({ data }: { data: { date: string; percent: number; total: number }[] }) {
  const W = 720, H = 220, PAD = { top: 20, right: 16, bottom: 32, left: 40 }
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const n = data.length
  const x = (i: number) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (p: number) => PAD.top + ih - (p / 100) * ih

  const points = data.map((d, i) => `${x(i)},${y(d.percent)}`).join(' ')
  const area = `${PAD.left},${PAD.top + ih} ${points} ${PAD.left + iw},${PAD.top + ih}`
  const last = data[n - 1]
  const first = data[0]
  const tickEvery = Math.max(1, Math.ceil(n / 6))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Readiness trend: ${first.percent}% on ${first.date} to ${last.percent}% on ${last.date}`}>
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={v === 75 ? '6 4' : undefined} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}%</text>
          </g>
        ))}
        <text x={W - PAD.right} y={y(75) - 6} textAnchor="end" fontSize="10" fill="var(--warning)">75% pass mark</text>
        <polygon points={area} fill="var(--primary)" opacity="0.12" />
        <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.percent)} r={i === n - 1 ? 5 : 3} fill={d.percent >= PASSING_RATE ? 'var(--success)' : 'var(--primary)'} stroke="var(--panel)" strokeWidth="2">
            <title>{`${new Date(d.date).toLocaleDateString()}: ${d.percent}% (${d.total} items)`}</title>
          </circle>
        ))}
        {data.map((d, i) => i % tickEvery === 0 || i === n - 1 ? (
          <text key={`t-${d.date}`} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ) : null)}
      </svg>
      <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--text)' }}>{data.length}</strong> active days</span>
        <span>Latest: <strong style={{ color: last.percent >= PASSING_RATE ? 'var(--success)' : 'var(--danger)' }}>{last.percent}%</strong></span>
        <span>Best day: <strong style={{ color: 'var(--text)' }}>{Math.max(...data.map(d => d.percent))}%</strong></span>
      </div>
    </div>
  )
}