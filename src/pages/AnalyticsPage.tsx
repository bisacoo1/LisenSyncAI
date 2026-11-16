import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram, getSubjectDetail } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type MockExam, type PracticeItem, type UserSubject } from '@/types'
import { Card, CardHeader, CardContent, Badge, Icon, ProgressBar, CircularProgress, EmptyState, Skeleton } from '@/components/ui'

export default function AnalyticsPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [exams, setExams] = useState<MockExam[]>([])
  const [weakDrills, setWeakDrills] = useState<PracticeItem[]>([])
  const [loading, setLoading] = useState(true)
  const isCourse = profile?.track === 'course'
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data: a } = await supabase.from('attempts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1000)
      const atts = (a as Attempt[]) || []
      setAttempts(atts)
      if (isCourse) {
        setExams([])
        const { data: subs } = await supabase.from('user_subjects').select('*').eq('user_id', profile.id).order('name')
        setUserSubjects((subs as UserSubject[]) || [])
      } else {
        const { data: e } = await supabase.from('mock_exams').select('*').eq('user_id', profile.id).order('started_at', { ascending: false }).limit(20)
        setExams((e as MockExam[]) || [])
      }
      setLoading(false)
    })()
  }, [profile?.id, isCourse])

  const subjectNames = useMemo(
    () => (isCourse ? userSubjects.map(s => s.name) : program?.subjects || []),
    [isCourse, userSubjects, program]
  )
  const stats = useMemo(() => subjectNames.length ? computeSubjectStats(attempts, subjectNames) : [], [attempts, subjectNames])
  const overall = useMemo(() => overallPercent(attempts), [attempts])
  const readiness = readinessLabel(overall)
  const weakSubjects = isCourse
    ? stats.filter(s => s.total > 0 && s.percent < overall).sort((a, b) => a.percent - b.percent)
    : stats.filter(s => s.weak && s.total > 0)
  const recentPractice = useMemo(() => {
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const recent = attempts.filter(a => {
      const time = a.created_at ? new Date(a.created_at).getTime() : NaN
      return time >= now - week && time <= now
    })
    const previous = attempts.filter(a => {
      const time = a.created_at ? new Date(a.created_at).getTime() : NaN
      return time >= now - 2 * week && time < now - week
    })
    return {
      recentCount: recent.length,
      recentAccuracy: recent.length ? overallPercent(recent) : null,
      previousCount: previous.length,
      previousAccuracy: previous.length ? overallPercent(previous) : null,
    }
  }, [attempts])
  const strongestSubject = stats.filter(s => s.total > 0).slice().sort((a, b) => b.percent - a.percent || b.total - a.total)[0]
  const lowestSubject = stats.filter(s => s.total > 0).slice().sort((a, b) => a.percent - b.percent || b.total - a.total)[0]
  const submittedExams = useMemo(
    () => exams.filter(e => e.status === 'submitted' && e.score != null)
      .slice()
      .sort((a, b) => new Date(b.submitted_at || b.started_at).getTime() - new Date(a.submitted_at || a.started_at).getTime()),
    [exams]
  )
  const latestMock = submittedExams[0]
  const previousMock = submittedExams[1]
  const latestMockScore = latestMock?.score
  const previousMockScore = previousMock?.score
  const latestMockPassed = latestMock?.passed ?? (latestMockScore != null ? latestMockScore >= PASSING_RATE : null)

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
      const { data } = await supabase.from('practice_items').select('*').eq('user_id', profile!.id).in('subject', names).in('type', ['mcq', 'diagnosis', 'sequence', 'enumeration', 'identification']).limit(12)
      setWeakDrills((data as PracticeItem[]) || [])
    })()
  }, [profile, weakSubjects.map(s => s.subject).join('|')])

  if (!profile || (!isCourse && !program)) return null

  return (
    <div className="container workspace-page">
      <WorkspacePageHeader
        eyebrow={isCourse ? 'STUDY PROGRESS' : 'PHARMACY READINESS'} index="05" title={<>Your {isCourse ? 'study' : 'PhLE'} progress, <em>in focus.</em></>}
        description={isCourse ? 'Track your accuracy across your own study subjects and spot where to focus next.' : `Track your accuracy across all 6 BS Pharmacy modules and spot where to focus next to clear the ${PASSING_RATE}% PRC passing mark.`}
        action={<Badge variant={loading || attempts.length === 0 ? 'default' : isCourse ? 'primary' : readiness.tone === 'ok' ? 'success' : readiness.tone === 'warn' ? 'warning' : 'danger'} size="lg">
          <Icon name={loading || attempts.length === 0 ? 'activity' : isCourse ? 'book-open' : readiness.tone === 'ok' ? 'check-circle' : readiness.tone === 'warn' ? 'alert-triangle' : 'alert-circle'} size={14} />
          {loading ? 'Loading progress' : attempts.length === 0 ? 'No practice data yet' : isCourse ? `Practice accuracy: ${overall}%` : `Overall: ${overall}% — ${readiness.label}`}
        </Badge>}
      />

      {/* Stats Overview */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: 'var(--primary-bg)', color: 'var(--primary)', flexShrink: 0 }}>
              <Icon name="target" size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{isCourse ? 'PRACTICE ACCURACY' : 'OVERALL SCORE'}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: loading || attempts.length === 0 ? 'var(--muted)' : isCourse ? 'var(--primary)' : overall >= PASSING_RATE ? 'var(--success)' : overall >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{loading || attempts.length === 0 ? '—' : `${overall}%`}</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Across {attempts.length} recorded attempts</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: isCourse ? 'var(--primary-bg)' : 'var(--success-bg)', color: isCourse ? 'var(--primary)' : 'var(--success)', flexShrink: 0 }}>
              <Icon name={isCourse ? 'book-open' : 'flag'} size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{isCourse ? 'COURSE SUBJECTS' : 'PhLE TARGET BENCHMARK'}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: isCourse ? 'var(--primary)' : 'var(--success)' }}>{isCourse ? loading ? '—' : userSubjects.length : `${PASSING_RATE}%`}</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{isCourse ? 'Subjects in your study space' : 'PRC Pharmacist Licensure passing mark'}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: weakSubjects.length > 0 ? isCourse ? 'var(--warning-bg)' : 'var(--danger-bg)' : 'var(--success-bg)', color: weakSubjects.length > 0 ? isCourse ? 'var(--warning)' : 'var(--danger)' : 'var(--success)', flexShrink: 0 }}>
              <Icon name={weakSubjects.length > 0 ? 'alert-triangle' : 'check-circle'} size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{isCourse ? 'SUBJECTS TO REVISIT' : 'WEAK MODULES'}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: attempts.length === 0 ? 'var(--muted)' : weakSubjects.length > 0 ? isCourse ? 'var(--warning)' : 'var(--danger)' : 'var(--success)' }}>{loading || attempts.length === 0 ? '—' : weakSubjects.length}</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{loading ? 'Loading focus areas' : attempts.length === 0 ? 'Start practicing to see your focus areas' : isCourse ? weakSubjects.length > 0 ? 'Below your overall practice average' : 'No attempted subjects below your average' : weakSubjects.length > 0 ? 'PhLE modules below 75%' : 'No attempted modules below 75%'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="outlined" style={{ marginBottom: 24 }}>
        <CardHeader title={isCourse ? 'Study insights' : 'Progress insights'} icon="activity" subtitle={isCourse ? 'A closer look at recent practice, subject strengths, and where to focus next.' : 'A closer look at your recent practice, module strengths, and PhLE mock exams'} />
        <CardContent>
          <div className="progress-insights-grid">
            <article className="progress-insight">
              <span className="progress-insight-label"><Icon name="trending-up" size={15} aria-hidden="true" /> LAST 7 DAYS</span>
              <strong>{recentPractice.recentAccuracy == null ? '—' : `${recentPractice.recentAccuracy}%`}</strong>
              <p>
                {recentPractice.recentAccuracy == null
                  ? 'Practice this week to start a fresh progress comparison.'
                  : recentPractice.previousAccuracy == null
                    ? `${recentPractice.recentCount} responses this week; a comparison will appear after another week of practice.`
                    : `${recentPractice.recentCount} responses; ${recentPractice.recentAccuracy - recentPractice.previousAccuracy >= 0 ? '+' : ''}${recentPractice.recentAccuracy - recentPractice.previousAccuracy} points vs. the previous 7 days.`}
              </p>
            </article>
            <article className="progress-insight">
              <span className="progress-insight-label"><Icon name="star" size={15} aria-hidden="true" /> STRONGEST {isCourse ? 'SUBJECT' : 'MODULE'}</span>
              <strong>{strongestSubject ? `${strongestSubject.percent}%` : '—'}</strong>
              <p>{strongestSubject ? `${strongestSubject.subject} · ${strongestSubject.total} attempts` : 'Complete practice to see your strongest area.'}</p>
            </article>
            <article className="progress-insight">
              <span className="progress-insight-label"><Icon name="target" size={15} aria-hidden="true" /> {isCourse ? 'FOCUS AREA' : 'MODULE TO REVISIT'}</span>
              <strong>{lowestSubject ? `${lowestSubject.percent}%` : '—'}</strong>
              <p>
                {lowestSubject
                  ? `${lowestSubject.subject} · ${lowestSubject.total} attempts${isCourse ? lowestSubject.percent < overall ? ', below your overall practice average' : ', at or above your overall practice average' : lowestSubject.weak ? `, below the ${PASSING_RATE}% target` : ', currently on track'}`
                  : 'Complete practice to identify a focus area.'}
              </p>
            </article>
            {!isCourse && (
              <article className="progress-insight">
                <span className="progress-insight-label"><Icon name="timer" size={15} aria-hidden="true" /> LATEST MOCK EXAM</span>
                <strong>{latestMockScore == null ? '—' : `${latestMockScore}%`}</strong>
                <p>
                  {latestMockScore != null
                    ? `${latestMockPassed ? 'Passed' : 'Below target'}${previousMockScore == null ? '' : ` · ${latestMockScore - previousMockScore >= 0 ? '+' : ''}${latestMockScore - previousMockScore} points vs. prior exam`}`
                    : 'Submit your first mock exam to track exam-to-exam progress.'}
                </p>
              </article>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-Subject Performance */}
      <Card variant="outlined" style={{ marginBottom: 24 }}>
        <CardHeader title={isCourse ? 'Subject Performance' : 'Per-Module PhLE Performance'} icon="bar-chart" subtitle={isCourse ? `${stats.length} course subjects tracked` : `${program!.name} • ${stats.length} PhLE modules tracked`} />
        <CardContent>
          <div className="table-wrapper" role="region" aria-label={isCourse ? 'Course subject performance, scrollable table' : 'PhLE module performance, scrollable table'} tabIndex={0} style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: isCourse ? 620 : 740 }}>
              <thead>
                <tr>
                  <th>{isCourse ? 'Course Subject' : 'PhLE Module'}</th>
                  {!isCourse && <th style={{width: 80}}>Weight</th>}
                  <th style={{width: 90}}>Correct</th>
                  <th style={{width: 90}}>Total</th>
                  <th style={{minWidth: 230}}>Score</th>
                  <th style={{width: 170}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td><Skeleton variant="text" width={140} /></td>
                      {!isCourse && <td><Skeleton variant="text" width={40} /></td>}
                      <td><Skeleton variant="text" width={40} /></td>
                      <td><Skeleton variant="text" width={40} /></td>
                      <td><Skeleton variant="text" width={150} /></td>
                      <td><Skeleton variant="text" width={80} /></td>
                    </tr>
                  ))
                ) : stats.length === 0 ? (
                  <tr>
                    <td colSpan={isCourse ? 5 : 6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      {isCourse ? 'Add course subjects to start tracking performance.' : 'No module performance is available yet.'}
                    </td>
                  </tr>
                ) : (
                  stats.map(s => {
                    const detail = isCourse ? null : getSubjectDetail(s.subject)
                    const needsReview = isCourse ? s.percent < overall : s.weak
                    const scoreVariant = isCourse ? needsReview ? 'warning' : 'success' : s.percent >= PASSING_RATE ? 'success' : s.percent >= 60 ? 'warning' : 'danger'
                    const scoreColor = s.total === 0 ? 'var(--muted)' : isCourse ? needsReview ? 'var(--warning)' : 'var(--success)' : s.percent >= PASSING_RATE ? 'var(--success)' : s.percent >= 60 ? 'var(--warning)' : 'var(--danger)'
                    return (
                      <tr key={s.subject}>
                        <td style={{ fontWeight: 500 }}>
                          <div className="subject-cell">
                            {detail && (
                              <span className="subject-cell-icon" aria-hidden="true">
                                <Icon name={detail.icon} size={14} />
                              </span>
                            )}
                            <div>
                              <div>{s.subject}</div>
                              {detail && <span className="subject-cell-sub">{detail.moduleCode}</span>}
                            </div>
                          </div>
                        </td>
                        {!isCourse && <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{detail ? `${detail.weightPercent}%` : '—'}</td>}
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.correct}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{s.total}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {s.total > 0 ? <ProgressBar value={s.percent} max={100} size="sm" ariaLabel={`${s.subject} practice score`} variant={scoreVariant} style={{ flex: 1, minWidth: 150 }} /> : <div aria-hidden="true" style={{ flex: 1, minWidth: 150, height: 4, borderRadius: 999, background: 'var(--panel-2)' }} />}
                            <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 45, color: scoreColor }}>{s.total === 0 ? '—' : `${s.percent}%`}</span>
                          </div>
                        </td>
                        <td>
                          {s.total === 0 ? (
                            <Badge variant="default" size="sm">No data</Badge>
                          ) : (
                            <Badge variant={isCourse ? needsReview ? 'warning' : 'success' : s.weak ? 'danger' : 'success'} size="sm" dot>
                              {isCourse ? needsReview ? 'Below average' : 'At or above average' : s.weak ? 'Needs remediation' : 'On track'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Remediation & Mock History */}
      <div className="grid grid-2" style={{ marginBottom: 24, gridTemplateColumns: isCourse ? 'minmax(0, 1fr)' : undefined }}>
        {/* Targeted Remediation */}
        <Card variant="elevated">
          <CardHeader
            title={isCourse ? 'Subjects to Revisit' : 'Targeted Remediation Drills'}
            icon="brain"
            subtitle={isCourse ? 'Course subjects below your overall practice average' : 'Focus on these subjects to reach 75%'}
          />
          <CardContent>
            {weakSubjects.length === 0 ? (
              <EmptyState
                icon="check-circle"
                title={attempts.length === 0 ? 'Your focus areas will appear here' : isCourse ? 'No subjects below your average' : 'No weak subjects flagged'}
                description={attempts.length === 0 ? 'Complete a practice session to see where to focus next.' : isCourse ? 'Keep practicing across your subjects to make this comparison more useful.' : 'Keep building on your progress with practice and mock simulations.'}
              />
            ) : (
              <>
                <div className="pill-list" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                  {weakSubjects.map(s => (
                    <Badge key={s.subject} variant={isCourse ? 'warning' : 'danger'} size="sm" dot>
                      {s.subject} — {s.percent}%
                    </Badge>
                  ))}
                </div>
                {weakDrills.length === 0 ? (
                  <div style={{ padding: 20, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10, color: 'var(--warning)' }}>
                    <Icon name="alert-triangle" size={20} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{isCourse ? 'No practice items found yet' : 'No remediation drills found yet'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Generate more items in <strong>Reviewer &amp; Generate</strong> for these subjects.</div>
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weakDrills.map(d => (
                      <li key={d.id} className="remediation-drill">
                        <Badge variant="primary" size="sm" style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>{d.subject}</Badge>
                        <Badge variant={d.type === 'mcq' ? 'info' : d.type === 'diagnosis' ? 'warning' : 'success'} size="sm">{d.type.toUpperCase()}</Badge>
                        <span className="remediation-drill-copy">
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

        {/* Mock Exam History — board candidates only */}
        {!isCourse && (
        <Card variant="elevated">
          <CardHeader title="Mock Exam History" icon="timer" subtitle={`${exams.length} exam${exams.length !== 1 ? 's' : ''} recorded`} />
          <CardContent>
            {exams.length === 0 ? (
              <EmptyState
                icon="timer"
                title="No mock exams yet"
                description="Start a timed simulation to track your exam readiness."
                action={{ label: 'Start Mock Exam', onClick: () => navigate('/mock'), variant: 'primary' }}
              />
            ) : (
              <div className="table-wrapper" role="region" aria-label="Mock exam history, scrollable table" tabIndex={0}>
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
        )}
      </div>

      <Card variant="outlined">
        <CardHeader title={isCourse ? 'Course Practice Trend' : 'Readiness Trend'} icon="trending-up" subtitle={isCourse ? 'Daily accuracy across your course practice attempts.' : 'Daily accuracy across practice attempts.'} />
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState
              icon="trending-up"
              title="No activity yet"
              description={isCourse ? 'Complete practice questions to start tracking your study progress over time.' : 'Complete practice questions to start tracking your readiness over time.'}
            />
          ) : trend.length === 1 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="trending-up" size={40} style={{ color: 'var(--muted)', margin: '0 auto 12px', opacity: 0.6 }} />
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                {trend[0].percent}% on {new Date(trend[0].date).toLocaleDateString()} ({trend[0].total} items) — keep practicing to see your trend.
              </p>
            </div>
          ) : (
            <TrendChart data={trend} isCourse={isCourse} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TrendChart({ data, isCourse }: { data: { date: string; percent: number; total: number }[]; isCourse: boolean }) {
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
      <div className="table-wrapper" role="region" aria-label={isCourse ? 'Course practice trend, scrollable chart' : 'Readiness trend, scrollable chart'} tabIndex={0}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 600, maxWidth: 'none', height: 'auto', display: 'block' }} role="img" aria-label={`${isCourse ? 'Course practice trend' : 'Readiness trend'}: ${first.percent}% on ${first.date} to ${last.percent}% on ${last.date}`}>
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={!isCourse && v === PASSING_RATE ? '6 4' : undefined} />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}%</text>
            </g>
          ))}
          {!isCourse && <text x={W - PAD.right} y={y(PASSING_RATE) - 6} textAnchor="end" fontSize="10" fill="var(--warning)">{PASSING_RATE}% pass mark</text>}
          <polygon points={area} fill="var(--primary)" opacity="0.12" />
          <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <circle key={d.date} cx={x(i)} cy={y(d.percent)} r={i === n - 1 ? 5 : 3} fill={!isCourse && d.percent >= PASSING_RATE ? 'var(--success)' : 'var(--primary)'} stroke="var(--panel)" strokeWidth="2">
              <title>{`${new Date(d.date).toLocaleDateString()}: ${d.percent}% (${d.total} items)`}</title>
            </circle>
          ))}
          {data.map((d, i) => i % tickEvery === 0 || i === n - 1 ? (
            <text key={`t-${d.date}`} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          ) : null)}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--text)' }}>{data.length}</strong> {isCourse ? 'practice days' : 'active days'}</span>
        <span>Latest: <strong style={{ color: !isCourse && last.percent >= PASSING_RATE ? 'var(--success)' : isCourse ? 'var(--primary)' : 'var(--danger)' }}>{last.percent}%</strong></span>
        <span>Best day: <strong style={{ color: 'var(--text)' }}>{Math.max(...data.map(d => d.percent))}%</strong></span>
      </div>
    </div>
  )
}