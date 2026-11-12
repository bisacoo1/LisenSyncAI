import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt } from '@/types'

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

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="muted">{program.name}</p>
        </div>
        <span className={`badge ${readiness.tone}`}>Readiness: {overall}% — {readiness.label}</span>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>PRC Passing Benchmark</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{PASSING_RATE}%</div>
          <p className="muted">Target overall and per-subject mastery to pass the licensure exam.</p>
        </div>
        <div className="card">
          <h3>Board Subjects</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{program.subjects.length}</div>
          <p className="muted">Aligned to your official board syllabus and Table of Specifications.</p>
        </div>
        <div className="card">
          <h3>Attempts Tracked</h3>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : attempts.length}</div>
          <p className="muted">Practice and mock results feed your readiness analytics.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="grid" style={{ marginTop: 8 }}>
            <Link className="btn" to="/reviewer">Upload Reviewer & Generate Drills</Link>
            <Link className="btn secondary" to="/practice">Practice (MCQ / Diagnosis / Sequence)</Link>
            <Link className="btn secondary" to="/mock">Start Timed Mock Simulation</Link>
            <Link className="btn secondary" to="/analytics">View Readiness Analytics</Link>
          </div>
        </div>
        <div className="card">
          <h3>Weak Topics to Remediate</h3>
          {loading ? <p className="muted">Loading…</p> : weak.length === 0 ? (
            <p className="muted">No weak topics flagged yet from recorded attempts. Complete practice or a mock exam to generate targeted remediation insights.</p>
          ) : (
            <ul className="list">
              {weak.map(w => <li key={w.subject}><strong>{w.subject}</strong> — {w.percent}% ({w.correct}/{w.total}). Needs targeted remediation.</li>)}
            </ul>
          )}
          <hr />
          <h4 className="section-title">Your Board Subjects</h4>
          <div className="pill-list">{program.subjects.map(s => <span key={s} className="pill">{s}</span>)}</div>
        </div>
      </div>
    </div>
  )
}
