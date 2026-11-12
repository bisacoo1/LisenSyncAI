import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type MockExam, type PracticeItem } from '@/types'

export default function AnalyticsPage() {
  const { profile, user } = useAuth()
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
  }, [profile])

  const stats = useMemo(() => program ? computeSubjectStats(attempts, program.subjects) : [], [attempts, program])
  const overall = useMemo(() => overallPercent(attempts), [attempts])
  const readiness = readinessLabel(overall)
  const weakSubjects = stats.filter(s => s.weak)

  useEffect(() => {
    if (!profile || !weakSubjects.length) { setWeakDrills([]); return }
    ;(async () => {
      const names = weakSubjects.map(s => s.subject)
      const { data } = await supabase.from('practice_items').select('*').eq('user_id', profile!.id).in('subject', names).in('type', ['mcq', 'diagnosis', 'sequence']).limit(12)
      setWeakDrills((data as PracticeItem[]) || [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, weakSubjects.map(s => s.subject).join('|')])

  if (!profile || !program) return null

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="section-title">Readiness Analytics</h1>
          <p className="muted">Scores per board exam subject, weak-topic flags, and targeted remediation drills toward the {PASSING_RATE}% passing mark.</p>
        </div>
        <span className={`badge ${readiness.tone}`}>Overall: {overall}% — {readiness.label}</span>
      </div>

      {loading ? <div className="card">Loading…</div> : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <div className="card"><h3>Overall Score</h3><div style={{ fontSize: 28, fontWeight: 700 }}>{overall}%</div><p className="muted">Across {attempts.length} recorded attempts.</p></div>
            <div className="card"><h3>Target</h3><div style={{ fontSize: 28, fontWeight: 700 }}>{PASSING_RATE}%</div><p className="muted">PRC licensure passing benchmark.</p></div>
            <div className="card"><h3>Weak Subjects</h3><div style={{ fontSize: 28, fontWeight: 700 }}>{weakSubjects.length}</div><p className="muted">Subjects below 75% or with no attempts.</p></div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Per-Subject Performance ({program.name})</h3>
            <table className="table">
              <thead><tr><th>Subject</th><th>Correct</th><th>Total</th><th>Score</th><th>Status</th></tr></thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.subject}>
                    <td>{s.subject}</td>
                    <td>{s.correct}</td>
                    <td>{s.total}</td>
                    <td style={{ minWidth: 180 }}>
                      <div className="progress"><span style={{ width: `${Math.min(100, s.percent)}%`, background: s.percent >= PASSING_RATE ? 'var(--ok)' : s.percent >= 60 ? 'var(--warn)' : 'var(--danger)' }} /></div>
                      <small>{s.percent}%</small>
                    </td>
                    <td><span className={`badge ${s.weak ? 'danger' : 'ok'}`}>{s.weak ? 'Needs remediation' : 'On track'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <h3>Targeted Remediation Drills</h3>
              {weakSubjects.length === 0 ? (
                <p className="muted">No weak subjects flagged. Maintain performance with continued timed mock simulations.</p>
              ) : (
                <>
                  <p className="muted">Focus on these subjects to reach {PASSING_RATE}%:</p>
                  <div className="pill-list" style={{ marginBottom: 12 }}>
                    {weakSubjects.map(s => <span key={s.subject} className="pill"><strong>{s.subject}</strong> — {s.percent}%</span>)}
                  </div>
                  {weakDrills.length === 0 ? (
                    <p className="muted">No remediation drills found yet for weak subjects. Generate more items in <strong>Reviewer & Generate</strong> for these subjects.</p>
                  ) : (
                    <ul className="list">
                      {weakDrills.map(d => (
                        <li key={d.id}><strong>[{d.subject}] {d.type.toUpperCase()}</strong> — {(d.question as any)?.stem || (d.question as any)?.prompt || (d.question as any)?.scenario?.slice(0, 80) || 'Practice item available in Practice mode'}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div className="card">
              <h3>Mock Exam History</h3>
              {exams.length === 0 ? <p className="muted">No mock exams submitted yet.</p> : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Items</th><th>Score</th><th>Result</th></tr></thead>
                  <tbody>
                    {exams.map(e => (
                      <tr key={e.id}>
                        <td className="muted">{new Date(e.started_at).toLocaleDateString()}</td>
                        <td>{e.total_items}</td>
                        <td>{e.score != null ? `${e.score}%` : '—'}</td>
                        <td>{e.status === 'submitted' ? <span className={`badge ${e.passed ? 'ok' : 'danger'}`}>{e.passed ? 'Passed' : 'Below 75%'}</span> : <span className="badge warn">In progress</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
