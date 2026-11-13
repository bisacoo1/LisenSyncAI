import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { PASSING_RATE, type Attempt, type DiagnosisAnswer, type DiagnosisQuestion, type McqAnswer, type McqQuestion, type MockExam, type MockExamItem, type PracticeItem, type Profile, type SequenceAnswer, type SequenceQuestion } from '@/types'
import { checkDiagnosis, checkSequence, computeBulkStatsUpdate } from '@/lib/analytics'
import LevelUpCelebration from '@/components/LevelUpCelebration'
import { Card, CardHeader, CardContent, Button, Badge, ProgressBar, Icon, EmptyState, Skeleton, Modal, useToast } from '@/components/ui'

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0')
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function MockExamPage() {
  const { profile, user, refreshProfile } = useAuth()
  const program = profile ? getProgram(profile.board_program) : null
  const [exam, setExam] = useState<MockExam | null>(null)
  const [items, setItems] = useState<MockExamItem[]>([])
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [seqOrder, setSeqOrder] = useState<string[]>([])
  const submittedRef = useRef(false)
  const { addToast } = useToast()
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [levelUp, setLevelUp] = useState<number | null>(null)

  function moveSeq(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= seqOrder.length) return
    const copy = [...seqOrder]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setSeqOrder(copy)
  }

  useEffect(() => { if (profile) loadInProgress() }, [profile])

  useEffect(() => {
    if (!exam || exam.status !== 'in_progress' || remaining == null) return
    if (remaining <= 0 && !submittedRef.current) { submitExam(true); return }
    const t = setTimeout(() => setRemaining(r => (r == null ? r : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [remaining, exam])

  // Update seqOrder when current item changes (for sequence questions)
  useEffect(() => {
    const it = items[current]
    if (it && it.type === 'sequence') {
      const q = it.question as SequenceQuestion
      setSeqOrder([...(q.items || [])].sort(() => Math.random() - 0.5))
    }
  }, [current, items])

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
      addToast({ type: 'success', title: 'Mock exam started', message: 'Answers and rationales will be revealed only after submission.' })
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
      try {
        const { data: fresh } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (fresh) {
          const today = new Date().toISOString().slice(0, 10)
          const updates = computeBulkStatsUpdate(fresh as Profile, correctCount, items.length, today)
          if ((updates.level ?? 0) > ((fresh as Profile).level ?? 1)) setLevelUp(updates.level ?? null)
          await supabase.from('profiles').update(updates).eq('id', user.id)
          await refreshProfile()
        }
      } catch { /* XP/stats update is best-effort; exam result already saved */ }
      const { data } = await supabase.from('mock_exams').select('*').eq('id', exam.id).single()
      setExam(data as MockExam)
      const { data: its } = await supabase.from('mock_exam_items').select('*').eq('exam_id', exam.id).order('position', { ascending: true })
      setItems((its as MockExamItem[]) || [])
      setShowResults(true)
      addToast({ type: passed ? 'success' : 'warning', title: auto ? 'Time expired' : 'Exam submitted', message: `Score: ${score}% — ${passed ? 'PASSED (≥75%)' : 'Below 75% benchmark'}` })
    } catch (e: any) { setErr(e.message); submittedRef.current = false } finally { setBusy(false) }
  }

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false)
    await submitExam(false)
  }

  if (!profile || !program) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div style={{ padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>Unable to load profile or program. Please complete onboarding first.</span>
        </div>
      </div>
    )
  }

  const totalDuration = program.mockDurationMinutes * 60
  const elapsed = totalDuration - (remaining ?? 0)
  const progress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0

  // Setup state
  if (!exam) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700 }}>Timed Board Exam Mock Simulation</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>Multi-subject mock aligned to the official Table of Specifications (TOS), with countdown timer and no instant answers until submission.</p>
        </div>

        {err && (
          <div style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="alert-circle" size={20} />
            <span>{err}</span>
          </div>
        )}

        <div className="grid grid-2">
          <Card variant="elevated">
            <CardHeader title={program.name} icon="timer" subtitle={`${program.mockDurationMinutes} minutes • ${PASSING_RATE}% passing benchmark`} />
            <CardContent>
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Table of Specifications (TOS)</h4>
                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Subject</th><th style={{width: 80}}>Items</th><th style={{width: 100}}>Weight</th></tr></thead>
                    <tbody>
                      {program.tos.map(t => (
                        <tr key={t.subject}>
                          <td>{t.subject}</td>
                          <td style={{fontVariantNumeric: 'tabular-nums', fontWeight: 600}}>{t.items}</td>
                          <td style={{fontVariantNumeric: 'tabular-nums', color: 'var(--muted)'}}>{t.weightPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Button variant="primary" fullWidth size="lg" leftIcon="timer" onClick={startExam} disabled={busy}>
                {busy ? 'Starting…' : 'Start Mock Exam'}
              </Button>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader title="Exam Rules" icon="info" subtitle="Read carefully before starting" />
            <CardContent>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="clock" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span>Strict timed simulation; timer counts down continuously.</span>
                </li>
                <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="eye-off" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span>No instant answers or rationales until you submit (or time expires).</span>
                </li>
                <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="book-open" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span>Questions drawn from your generated practice bank per subject allocation.</span>
                </li>
                <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="bar-chart" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span>Results update your per-subject readiness analytics and remediation targets.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Submitted results
  if (exam.status === 'submitted') {
    const score = exam.score ?? 0
    const passed = exam.passed ?? false

    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 700 }}>Mock Exam Results</h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>{exam.title}</p>
          </div>
          <Badge variant={passed ? 'success' : 'danger'} size="lg">
            <Icon name={passed ? 'check-circle' : 'x-circle'} size={14} />
            {score}% — {passed ? 'PASSED (≥75%)' : 'BELOW 75% BENCHMARK'}
          </Badge>
        </div>

        <Card variant="elevated" style={{ marginBottom: 24 }}>
          <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>FINAL SCORE</div>
                <div style={{ fontSize: 48, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--danger)' }}>{score}%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>CORRECT / TOTAL</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{items.filter(i => i.is_correct).length} / {items.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>SUBMITTED</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{exam.submitted_at ? new Date(exam.submitted_at).toLocaleString() : '—'}</div>
              </div>
            </div>
            <Button variant="secondary" leftIcon="rotate-ccw" onClick={() => { setExam(null); setItems([]); setResponses({}); setCurrent(0); submittedRef.current = false; setShowResults(false) }}>
              Back to Mock Setup
            </Button>
          </CardContent>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it, i) => (
            <Card key={it.id} variant="outlined">
              <CardContent>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <Badge variant={it.is_correct ? 'success' : 'danger'} size="sm">
                    <Icon name={it.is_correct ? 'check' : 'x'} size={10} />
                    #{i + 1} — {it.subject} — {it.type.toUpperCase()}
                  </Badge>
                  <Badge variant={it.is_correct ? 'success' : 'danger'} size="sm">
                    {it.is_correct ? 'Correct' : 'Incorrect'}
                  </Badge>
                </div>

                {it.type === 'mcq' && (
                  <>
                    <p style={{ marginBottom: 12, fontSize: 15, fontWeight: 500 }}><strong>Question:</strong> {(it.question as McqQuestion).stem}</p>
                    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(it.question as McqQuestion).options.map((o, j) => (
                        <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 8, background: j === (it.answer as McqAnswer).correctIndex ? 'var(--success-bg)' : j === (it.user_response as any)?.selected ? 'var(--danger-bg)' : 'var(--panel-2)', border: `1px solid ${j === (it.answer as McqAnswer).correctIndex ? 'var(--success-border)' : j === (it.user_response as any)?.selected ? 'var(--danger-border)' : 'var(--border)'}` }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: j === (it.answer as McqAnswer).correctIndex ? 'var(--success)' : j === (it.user_response as any)?.selected ? 'var(--danger)' : 'var(--border)', color: j === (it.answer as McqAnswer).correctIndex || j === (it.user_response as any)?.selected ? '#fff' : 'var(--muted)', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                            {String.fromCharCode(65 + j)}
                          </span>
                          <span style={{ flex: 1 }}>{o}</span>
                          {j === (it.answer as McqAnswer).correctIndex && <Icon name="check-circle" size={16} style={{ color: 'var(--success)' }} />}
                          {j === (it.user_response as any)?.selected && j !== (it.answer as McqAnswer).correctIndex && <Icon name="x-circle" size={16} style={{ color: 'var(--danger)' }} />}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {it.type === 'diagnosis' && (
                  <>
                    <div style={{ marginBottom: 8 }}><strong>Scenario:</strong> {(it.question as DiagnosisQuestion).scenario}</div>
                    <div style={{ marginBottom: 8 }}><strong>Prompt:</strong> {(it.question as DiagnosisQuestion).prompt}</div>
                    <div style={{ marginBottom: 8 }}><strong>Expected:</strong> {(it.answer as DiagnosisAnswer).expected}</div>
                    <div style={{ marginBottom: 8 }}><strong>Your answer:</strong> <span style={{ color: it.is_correct ? 'var(--success)' : 'var(--danger)' }}>{(it.user_response as any)?.text || '—'}</span></div>
                  </>
                )}

                {it.type === 'sequence' && (
                  <>
                    <p style={{ marginBottom: 12 }}><strong>Prompt:</strong> {(it.question as SequenceQuestion).prompt}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      <div><strong>Correct order:</strong></div>
                      <ol style={{ paddingLeft: 20, margin: 0 }}>
                        {(it.answer as SequenceAnswer).order.map((s, idx) => (
                          <li key={idx} style={{ marginBottom: 4, padding: 8, background: 'var(--success-bg)', borderRadius: 6, border: '1px solid var(--success-border)' }}>{idx + 1}. {s}</li>
                        ))}
                      </ol>
                      <div><strong>Your order:</strong></div>
                      <ol style={{ paddingLeft: 20, margin: 0 }}>
                        {((it.user_response as any)?.order || []).map((s: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: 4, padding: 8, background: ((it.user_response as any)?.order || []).join('|') === (it.answer as SequenceAnswer).order.join('|') ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 6, border: `1px solid ${((it.user_response as any)?.order || []).join('|') === (it.answer as SequenceAnswer).order.join('|') ? 'var(--success-border)' : 'var(--danger-border)'}` }}>{idx + 1}. {s}</li>
                        ))}
                      </ol>
                    </div>
                  </>
                )}

                {it.rationale && (
                  <div style={{ marginTop: 16, padding: 12, background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 8 }}>
                    <strong style={{ color: 'var(--primary)' }}>Rationale:</strong> <span style={{ marginLeft: 8 }}>{it.rationale}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {levelUp != null && <LevelUpCelebration level={levelUp} onClose={() => setLevelUp(null)} />}
      </div>
    )
  }

  // In-progress exam
  const it = items[current]
  const resp = it ? responses[it.id] : null
  const answeredCount = items.filter(i => responses[i.id] != null).length

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 48, maxWidth: 900 }}>
      {/* Header with timer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Mock Exam (In Progress)</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No answers or rationales shown until submission. Answer all items before time runs out.</p>
        </div>
        <Card variant="elevated" style={{ padding: '12px 20px', minWidth: 180 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Time Remaining</div>
          <div className="timer" style={{ fontSize: 28, fontWeight: 700, color: remaining != null && remaining < 300 ? 'var(--danger)' : 'var(--primary)' }}>
            {remaining != null ? formatTime(remaining) : '--:--:--'}
          </div>
          <ProgressBar value={progress} max={100} size="sm" variant={remaining != null && remaining < 300 ? 'danger' : 'primary'} style={{ marginTop: 8, width: 160 }} />
        </Card>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>{err}</span>
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="check-circle" size={20} />
          <span>{msg}</span>
        </div>
      )}

      {it ? (
        <Card variant="elevated">
          <CardContent style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge variant="primary" size="md">
                Item {current + 1} of {items.length} — {it.subject} — {it.type.toUpperCase()}
              </Badge>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="sm" leftIcon="chevron-left" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>Previous</Button>
                <Button variant="secondary" size="sm" rightIcon="chevron-right" onClick={() => setCurrent(c => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1}>Next</Button>
                <Button variant="danger" size="sm" leftIcon="flag" onClick={() => setShowSubmitConfirm(true)} disabled={busy}>Submit Exam</Button>
              </div>
            </div>

            {it.type === 'mcq' && (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{(it.question as McqQuestion).stem}</h3>
                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
                    Question {current + 1} of {items.length}: Choose the best answer
                  </legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(it.question as McqQuestion).options.map((opt, i) => (
                      <label key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                        borderRadius: 10, border: '2px solid',
                        borderColor: resp?.selected === i ? 'var(--primary)' : 'var(--border)',
                        background: resp?.selected === i ? 'var(--primary-bg)' : 'var(--panel-2)',
                        cursor: 'pointer', transition: 'all 150ms ease'
                      }}>
                        <input type="radio" name={`mcq-${it.id}`} checked={resp?.selected === i} onChange={() => setResponse(it.id, { selected: i })} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: resp?.selected === i ? 'var(--primary)' : 'var(--border)', color: resp?.selected === i ? '#041014' : 'var(--muted)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span style={{ flex: 1, fontSize: 14 }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {it.type === 'diagnosis' && (
              <>
                <div style={{ marginBottom: 12 }}><strong style={{ fontSize: 14 }}>Scenario</strong></div>
                <p style={{ marginBottom: 16, padding: 16, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, lineHeight: 1.7 }}>{(it.question as DiagnosisQuestion).scenario}</p>
                <div style={{ marginBottom: 8 }}><strong style={{ fontSize: 14 }}>{(it.question as DiagnosisQuestion).prompt}</strong></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={resp?.text || ''}
                    onChange={e => setResponse(it.id, { text: e.target.value })}
                    placeholder="Enter the exact concept/principle/law/formula..."
                    style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', color: 'var(--text)', fontSize: 14 }}
                  />
                </div>
              </>
            )}

            {it.type === 'sequence' && (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>{(it.question as SequenceQuestion).prompt}</h3>
                <p className="muted" style={{ marginBottom: 16 }}>Arrange items in the correct chronological/priority order (top = first).</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {seqOrder.map((item, i) => (
                    <div key={item + i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', gap: 12
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#041014', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 14 }}>{item}</span>
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="ghost" size="icon" onClick={() => moveSeq(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="chevron-up" size={16} aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => moveSeq(i, 1)} disabled={i === seqOrder.length - 1} aria-label="Move down"><Icon name="chevron-down" size={16} aria-hidden="true" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <Button variant="secondary" leftIcon="chevron-left" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>Previous</Button>
              <Button variant="secondary" rightIcon="chevron-right" onClick={() => setCurrent(c => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1}>Next</Button>
              <Button variant="danger" leftIcon="flag" onClick={() => setShowSubmitConfirm(true)} disabled={busy}>Submit Exam</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined"><CardContent><EmptyState icon="alert-circle" title="No items in this exam" /></CardContent></Card>
      )}

      {/* Navigator */}
      <Card variant="outlined" style={{ marginTop: 20 }}>
        <CardContent>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Question Navigator</h4>
            <Badge variant="default" size="sm">{answeredCount}/{items.length} answered</Badge>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setCurrent(i)}
                aria-label={`Go to question ${i + 1}${responses[x.id] ? ' (answered)' : ''}${i === current ? ' (current)' : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 10, border: '2px solid',
                  borderColor: i === current ? 'var(--primary)' : responses[x.id] ? 'var(--success)' : 'var(--border)',
                  background: i === current ? 'var(--primary-bg)' : responses[x.id] ? 'var(--success-bg)' : 'var(--panel-2)',
                  color: i === current ? 'var(--primary)' : responses[x.id] ? 'var(--success)' : 'var(--text)',
                  fontWeight: 600, fontSize: 13, transition: 'all 150ms ease', minWidth: 44
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit Confirmation Modal */}
      <Modal
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Submit Exam?"
        size="sm"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !busy) handleConfirmSubmit(); if (e.key === 'Escape') setShowSubmitConfirm(false); }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmSubmit} disabled={busy}>Submit Exam</Button>
          </div>
        }
      >
        <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>You have answered {answeredCount} of {items.length} questions. Are you sure you want to submit?</p>
          {answeredCount < items.length ? (
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--warning)' }}>Unanswered questions will be marked incorrect.</strong></p>
          ) : null}
        </div>
      </Modal>

      {levelUp != null && <LevelUpCelebration level={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  )
}