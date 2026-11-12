import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { PASSING_RATE, type DiagnosisAnswer, type DiagnosisQuestion, type McqAnswer, type McqQuestion, type MockExam, type MockExamItem, type PracticeItem, type SequenceAnswer, type SequenceQuestion } from '@/types'
import { checkDiagnosis, checkSequence } from '@/lib/analytics'

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0')
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function MockExamPage() {
  const { profile, user } = useAuth()
  const program = profile ? getProgram(profile.board_program) : null
  const [exam, setExam] = useState<MockExam | null>(null)
  const [items, setItems] = useState<MockExamItem[]>([])
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => { if (profile) loadInProgress() }, [profile])

  useEffect(() => {
    if (!exam || exam.status !== 'in_progress' || remaining == null) return
    if (remaining <= 0 && !submittedRef.current) { submitExam(true); return }
    const t = setTimeout(() => setRemaining(r => (r == null ? r : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [remaining, exam])

  async function loadInProgress() {
    if (!profile) return
    const { data } = await supabase.from('mock_exams').select('*').eq('user_id', profile.id).eq('status', 'in_progress').order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (data) {
      const ex = data as MockExam
      setExam(ex)
      const { data: its } = await supabase.from('mock_exam_items').select('*').eq('exam_id', ex.id).order('position', { ascending: true })
      const list = (its as MockExamItem[]) || []
      setItems(list)
      const start = new Date(ex.started_at).getTime()
      const end = start + ex.duration_minutes * 60 * 1000
      setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)))
      const r: Record<string, any> = {}
      list.forEach(it => { if (it.user_response != null) r[it.id] = it.user_response })
      setResponses(r)
    }
  }

  async function startExam() {
    if (!profile || !user || !program) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      let pool: PracticeItem[] = []
      for (const alloc of program.tos) {
        const { data } = await supabase.from('practice_items').select('*').eq('user_id', user.id).eq('subject', alloc.subject).in('type', ['mcq', 'diagnosis', 'sequence']).limit(alloc.items * 3)
        let got = (data as PracticeItem[]) || []
        if (got.length < alloc.items) {
          const { data: more } = await supabase.from('practice_items').select('*').eq('user_id', user.id).eq('subject', alloc.subject).limit(alloc.items * 3)
          got = (more as PracticeItem[]) || []
        }
        const shuffled = [...got].sort(() => Math.random() - 0.5).slice(0, alloc.items)
        pool = pool.concat(shuffled)
      }
      if (pool.length === 0) { setErr('No practice items available. Generate MCQ, diagnosis, or sequence items in Reviewer & Generate first.'); setBusy(false); return }
      const { data: ex, error } = await supabase.from('mock_exams').insert({
        user_id: user.id, board_program: profile.board_program, title: `${program.name} - Mock Simulation`,
        duration_minutes: program.mockDurationMinutes, tos: program.tos, total_items: pool.length, status: 'in_progress'
      }).select().single()
      if (error) throw error
      const examId = (ex as any).id
      const rows = pool.map((p, i) => ({
        exam_id: examId, practice_item_id: p.id, subject: p.subject, type: p.type,
        question: p.question, answer: p.answer, rationale: p.rationale, position: i
      }))
      const { error: ierr } = await supabase.from('mock_exam_items').insert(rows)
      if (ierr) throw ierr
      submittedRef.current = false
      await loadInProgress()
      setMsg('Mock exam started. Answers and rationales will be revealed only after submission.')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  function setResponse(itemId: string, value: any) {
    setResponses(r => ({ ...r, [itemId]: value }))
  }

  async function submitExam(auto = false) {
    if (!exam || !user || submittedRef.current) return
    submittedRef.current = true
    setBusy(true); setErr(null)
    try {
      let correctCount = 0
      for (const it of items) {
        const resp = responses[it.id]
        let correct = false
        if (it.type === 'mcq') correct = resp?.selected === (it.answer as McqAnswer).correctIndex
        else if (it.type === 'diagnosis') correct = checkDiagnosis(resp?.text || '', (it.answer as DiagnosisAnswer).expected, (it.answer as DiagnosisAnswer).acceptable || [])
        else if (it.type === 'sequence') correct = checkSequence(resp?.order || [], (it.answer as SequenceAnswer).order || [])
        if (correct) correctCount++
        await supabase.from('mock_exam_items').update({ user_response: resp ?? null, is_correct: correct }).eq('id', it.id)
        await supabase.from('attempts').insert({ user_id: user.id, practice_item_id: it.practice_item_id, board_program: exam.board_program, subject: it.subject, type: it.type, user_response: resp ?? null, is_correct: correct })
      }
      const score = items.length ? Math.round((correctCount / items.length) * 1000) / 10 : 0
      const passed = score >= PASSING_RATE
      await supabase.from('mock_exams').update({ status: 'submitted', submitted_at: new Date().toISOString(), score, passed }).eq('id', exam.id)
      const { data } = await supabase.from('mock_exams').select('*').eq('id', exam.id).single()
      setExam(data as MockExam)
      const { data: its } = await supabase.from('mock_exam_items').select('*').eq('exam_id', exam.id).order('position', { ascending: true })
      setItems((its as MockExamItem[]) || [])
      setMsg(auto ? 'Time is up. Exam auto-submitted.' : 'Exam submitted.')
    } catch (e: any) { setErr(e.message); submittedRef.current = false } finally { setBusy(false) }
  }

  if (!profile || !program) return null

  if (!exam) {
    return (
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="section-title">Timed Board Exam Mock Simulation</h1>
            <p className="muted">Multi-subject mock aligned to the official Table of Specifications (TOS), with countdown timer and no instant answers until submission.</p>
          </div>
        </div>
        {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
        {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
        <div className="grid grid-2">
          <div className="card">
            <h3>{program.name}</h3>
            <p><strong>Duration:</strong> {program.mockDurationMinutes} minutes</p>
            <p><strong>Passing benchmark:</strong> {PASSING_RATE}%</p>
            <h4>Table of Specifications (TOS)</h4>
            <table className="table">
              <thead><tr><th>Subject</th><th>Items</th><th>Weight</th></tr></thead>
              <tbody>
                {program.tos.map(t => <tr key={t.subject}><td>{t.subject}</td><td>{t.items}</td><td>{t.weightPercent}%</td></tr>)}
              </tbody>
            </table>
            <button className="btn" onClick={startExam} disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Starting…' : 'Start Mock Exam'}</button>
          </div>
          <div className="card">
            <h3>Rules</h3>
            <ul className="list">
              <li>Strict timed simulation; timer counts down continuously.</li>
              <li>No instant answers or rationales until you submit (or time expires).</li>
              <li>Questions are drawn from your generated practice bank per subject allocation.</li>
              <li>Results update your per-subject readiness analytics and remediation targets.</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (exam.status === 'submitted') {
    const score = exam.score ?? 0
    return (
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="section-title">Mock Exam Results</h1>
            <p className="muted">{exam.title}</p>
          </div>
          <span className={`badge ${exam.passed ? 'ok' : 'danger'}`}>{score}% — {exam.passed ? 'PASSED (≥75%)' : 'BELOW 75% BENCHMARK'}</span>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <p><strong>Score:</strong> {score}% ({items.filter(i => i.is_correct).length}/{items.length})</p>
          <p><strong>Submitted:</strong> {exam.submitted_at ? new Date(exam.submitted_at).toLocaleString() : '—'}</p>
          <button className="btn secondary" onClick={() => { setExam(null); setItems([]); setResponses({}); setCurrent(0); submittedRef.current = false }}>Back to Mock Setup</button>
        </div>
        <div className="grid">
          {items.map((it, i) => (
            <div key={it.id} className="card">
              <div className="muted">#{i + 1} — {it.subject} — {it.type} — <span className={it.is_correct ? 'badge ok' : 'badge danger'}>{it.is_correct ? 'Correct' : 'Incorrect'}</span></div>
              {it.type === 'mcq' && (
                <>
                  <p><strong>{(it.question as McqQuestion).stem}</strong></p>
                  <ul className="list">{(it.question as McqQuestion).options.map((o, j) => <li key={j}>{j === (it.answer as McqAnswer).correctIndex ? '✓ ' : ''}{String.fromCharCode(65 + j)}. {o}</li>)}</ul>
                </>
              )}
              {it.type === 'diagnosis' && (
                <>
                  <p><strong>Scenario:</strong> {(it.question as DiagnosisQuestion).scenario}</p>
                  <p><strong>Prompt:</strong> {(it.question as DiagnosisQuestion).prompt}</p>
                  <p><strong>Expected:</strong> {(it.answer as DiagnosisAnswer).expected}</p>
                  <p><strong>Your answer:</strong> {(it.user_response as any)?.text || '—'}</p>
                </>
              )}
              {it.type === 'sequence' && (
                <>
                  <p><strong>{(it.question as SequenceQuestion).prompt}</strong></p>
                  <p><strong>Correct order:</strong> {(it.answer as SequenceAnswer).order.join(' → ')}</p>
                  <p><strong>Your order:</strong> {((it.user_response as any)?.order || []).join(' → ') || '—'}</p>
                </>
              )}
              <p><strong>Rationale:</strong> {it.rationale || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const it = items[current]
  const resp = it ? responses[it.id] : null

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="section-title">Mock Exam (In Progress)</h1>
          <p className="muted">No answers or rationales shown until submission. Answer all items before time runs out.</p>
        </div>
        <div className="card"><div className="muted">Time Remaining</div><div className="timer" style={{ fontSize: 22 }}>{remaining != null ? formatTime(remaining) : '--:--:--'}</div></div>
      </div>
      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}

      {it ? (
        <div className="card">
          <div className="muted">Item {current + 1} of {items.length} — {it.subject} — {it.type}</div>
          {it.type === 'mcq' && (
            <>
              <h3 style={{ marginTop: 8 }}>{(it.question as McqQuestion).stem}</h3>
              <div className="grid" style={{ marginTop: 12 }}>
                {(it.question as McqQuestion).options.map((opt, i) => (
                  <label key={i} className="pill" style={{ display: 'block', cursor: 'pointer', borderColor: resp?.selected === i ? 'var(--primary)' : undefined }}>
                    <input type="radio" name={`mcq-${it.id}`} checked={resp?.selected === i} onChange={() => setResponse(it.id, { selected: i })} /> {String.fromCharCode(65 + i)}. {opt}
                  </label>
                ))}
              </div>
            </>
          )}
          {it.type === 'diagnosis' && (
            <>
              <p style={{ marginTop: 8 }}><strong>Scenario:</strong> {(it.question as DiagnosisQuestion).scenario}</p>
              <p><strong>{(it.question as DiagnosisQuestion).prompt}</strong></p>
              <div className="field"><label>Your identification</label><input value={resp?.text || ''} onChange={e => setResponse(it.id, { text: e.target.value })} /></div>
            </>
          )}
          {it.type === 'sequence' && (
            <>
              <p style={{ marginTop: 8 }}><strong>{(it.question as SequenceQuestion).prompt}</strong></p>
              {(() => {
                const q = it.question as SequenceQuestion
                const order: string[] = resp?.order || q.items
                const move = (i: number, dir: -1 | 1) => {
                  const j = i + dir; if (j < 0 || j >= order.length) return
                  const copy = [...order]; [copy[i], copy[j]] = [copy[j], copy[i]]; setResponse(it.id, { order: copy })
                }
                return <div className="grid">{order.map((s, i) => (
                  <div key={s + i} className="pill" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>{i + 1}.</strong> {s}</span>
                    <span>
                      <button className="btn secondary" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>{' '}
                      <button className="btn secondary" onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
                    </span>
                  </div>
                ))}</div>
              })()}
            </>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>Previous</button>
            <button className="btn secondary" onClick={() => setCurrent(c => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1}>Next</button>
            <button className="btn" onClick={() => submitExam(false)} disabled={busy}>Submit Exam</button>
          </div>
        </div>
      ) : <div className="card">No items in this exam.</div>}

      <div className="card" style={{ marginTop: 16 }}>
        <h4>Navigator</h4>
        <div className="pill-list">
          {items.map((x, i) => (
            <button key={x.id} className="pill" style={{ borderColor: i === current ? 'var(--primary)' : responses[x.id] ? 'var(--ok)' : undefined }} onClick={() => setCurrent(i)}>{i + 1}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
