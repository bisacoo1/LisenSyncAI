import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram, getSubjectDetail } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { PASSING_RATE, type DiagnosisAnswer, type DiagnosisQuestion, type McqAnswer, type McqQuestion, type MockExam, type MockExamItem, type PracticeItem, type SequenceAnswer, type SequenceQuestion } from '@/types'
import { buildMockSubmissionAnswers, isMockAnswerCorrect, selectMockExamItems } from '@/lib/mockExam'
import LevelUpCelebration from '@/components/LevelUpCelebration'
import { AnimatedNumber, Card, CardHeader, CardContent, Button, Badge, ProgressBar, Icon, EmptyState, Skeleton, Modal, useToast } from '@/components/ui'

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
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [current, setCurrent] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [seqOrder, setSeqOrder] = useState<string[]>([])
  const submittedRef = useRef(false)
  const submitExamRef = useRef<(auto?: boolean) => Promise<void>>(async () => {})
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPersist = useRef<{ id: string; value: unknown } | null>(null)
  const { addToast } = useToast()
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [levelUp, setLevelUp] = useState<number | null>(null)

  function draftKey(examId: string) {
    return `mock-exam-draft:${examId}`
  }

  function readDraft(examId: string): Record<string, unknown> {
    try {
      const saved = localStorage.getItem(draftKey(examId))
      if (!saved) return {}
      const parsed: unknown = JSON.parse(saved)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch (error) {
      addToast({ type: 'error', title: 'Could not restore exam draft', message: error instanceof Error ? error.message : 'Local storage is unavailable.' })
      return {}
    }
  }

  async function persistResponse(itemId: string, value: unknown) {
    const { error } = await supabase.from('mock_exam_items').update({ user_response: value ?? null }).eq('id', itemId)
    if (error) addToast({ type: 'error', title: 'Could not save answer', message: error.message })
  }

  function setResponse(itemId: string, value: unknown, debounce = false) {
    setResponses(r => ({ ...r, [itemId]: value }))
    if (exam) {
      try {
        const draft = readDraft(exam.id)
        localStorage.setItem(draftKey(exam.id), JSON.stringify({ ...draft, [itemId]: value }))
      } catch (error) {
        addToast({ type: 'error', title: 'Could not preserve exam draft', message: error instanceof Error ? error.message : 'Local storage is unavailable.' })
      }
    }
    if (!debounce) {
      void persistResponse(itemId, value)
      return
    }
    pendingPersist.current = { id: itemId, value }
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      const p = pendingPersist.current
      pendingPersist.current = null
      if (p) void persistResponse(p.id, p.value)
    }, 600)
  }

  useEffect(() => {
    const flushPending = () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = null
      const pending = pendingPersist.current
      pendingPersist.current = null
      if (pending) void persistResponse(pending.id, pending.value)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending()
    }
    window.addEventListener('pagehide', flushPending)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushPending)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flushPending()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
  }, [])

  function moveSeq(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= seqOrder.length) return
    const copy = [...seqOrder]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setSeqOrder(copy)
    const item = items[current]
    if (item?.type === 'sequence') setResponse(item.id, { order: copy })
  }

  useEffect(() => { if (profile) loadInProgress() }, [profile?.id])

  useEffect(() => {
    if (!exam || exam.status !== 'in_progress' || remaining == null) return
    if (remaining <= 0 && !submittedRef.current) { void submitExamRef.current(true); return }
    const t = setTimeout(() => setRemaining(r => (r == null ? r : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [remaining, exam])

  // Update seqOrder when the current item changes; restore a saved order if one exists
  useEffect(() => {
    const it = items[current]
    if (it && it.type === 'sequence') {
      const q = it.question as SequenceQuestion
      const itemsList = q.items || []
      const saved = (responses[it.id] as any)?.order
      const isPermutation = Array.isArray(saved) && saved.length === itemsList.length &&
        [...saved].sort().join('|') === [...itemsList].sort().join('|')
      setSeqOrder(isPermutation ? saved : [...itemsList].sort(() => Math.random() - 0.5))
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
      const r: Record<string, unknown> = {}
      list.forEach(it => { if (it.user_response != null) r[it.id] = it.user_response })
      setResponses({ ...r, ...readDraft(ex.id) })
    }
  }

  async function startExam() {
    if (!profile || !user || !program) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      const { data, error: poolError } = await supabase
        .from('practice_items')
        .select('*')
        .eq('user_id', user.id)
        .in('subject', program.tos.map(allocation => allocation.subject))
        .in('type', ['mcq', 'diagnosis', 'sequence'])
      if (poolError) throw poolError
      const pool = selectMockExamItems(program.tos, (data as PracticeItem[]) || [])
      const { data: ex, error } = await supabase.from('mock_exams').insert({
        user_id: user.id, board_program: program.key, title: `${program.name} - Mock Simulation`,
        duration_minutes: program.mockDurationMinutes, tos: program.tos, total_items: pool.length, status: 'in_progress'
      }).select().single()
      if (error) throw error
      const examId = (ex as any).id
      const rows = pool.map((p, i) => ({
        exam_id: examId, practice_item_id: p.id, subject: p.subject, type: p.type,
        question: p.question, answer: p.answer, rationale: p.rationale, position: i
      }))
      const { error: ierr } = await supabase.from('mock_exam_items').insert(rows)
      if (ierr) {
        await supabase.from('mock_exams').delete().eq('id', examId)
        throw ierr
      }
      submittedRef.current = false
      await loadInProgress()
      addToast({ type: 'success', title: 'Mock exam started', message: 'Answers and rationales will be revealed only after submission.' })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function submitExam(auto = false) {
    if (!exam || !user || submittedRef.current) return
    submittedRef.current = true
    setBusy(true); setErr(null)
    try {
      let effectiveResponses = { ...responses }
      if (persistTimer.current) clearTimeout(persistTimer.current)
      const pending = pendingPersist.current
      pendingPersist.current = null
      if (pending) {
        effectiveResponses = { ...effectiveResponses, [pending.id]: pending.value }
        setResponses(effectiveResponses)
      }
      const { data: submissionData, error: submissionError } = await supabase.rpc('submit_mock_exam', {
        p_exam_id: exam.id,
        p_answers: buildMockSubmissionAnswers(items, effectiveResponses),
      })
      if (submissionError) throw new Error(submissionError.message)
      const submission = Array.isArray(submissionData) ? submissionData[0] : submissionData
      if (!submission) throw new Error('Exam submission returned no result.')

      const score = Number(submission.score)
      const passed = Boolean(submission.passed)
      const pointsAwarded = Number(submission.points_awarded) || 0
      if (submission.level > submission.previous_level) setLevelUp(submission.level)
      try {
        await refreshProfile()
      } catch (profileError) {
        addToast({ type: 'error', title: 'Could not refresh profile progress', message: profileError instanceof Error ? profileError.message : 'Progress was saved, but the profile could not be refreshed.' })
      }
      try {
        localStorage.removeItem(draftKey(exam.id))
      } catch (storageError) {
        addToast({ type: 'error', title: 'Could not clear saved exam draft', message: storageError instanceof Error ? storageError.message : 'Local storage is unavailable.' })
      }
      const { data: submittedExam, error: submittedExamError } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('id', exam.id)
        .single()
      if (submittedExamError) {
        addToast({ type: 'warning', title: 'Result refresh failed', message: submittedExamError.message })
        setExam({
          ...exam,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          score,
          passed,
        })
      } else {
        setExam(submittedExam as MockExam)
      }

      const { data: submittedItems, error: submittedItemsError } = await supabase
        .from('mock_exam_items')
        .select('*')
        .eq('exam_id', exam.id)
        .order('position', { ascending: true })
      if (submittedItemsError) {
        addToast({ type: 'warning', title: 'Answer review refresh failed', message: submittedItemsError.message })
        setItems(items.map(it => ({
          ...it,
          user_response: effectiveResponses[it.id] ?? null,
          is_correct: isMockAnswerCorrect(it, effectiveResponses[it.id]),
        })))
      } else {
        setItems((submittedItems as MockExamItem[]) || [])
      }
      setShowResults(true)
      addToast({
        type: passed ? 'success' : 'warning',
        title: auto ? 'Time expired' : 'Exam submitted',
        message: `Score: ${score}% — ${passed ? 'PASSED (≥75% overall, no subject <50%)' : 'Below passing rule'}${pointsAwarded ? ` · +${pointsAwarded} leaderboard points` : ''}`,
      })
    } catch (e: any) { setErr(e.message); submittedRef.current = false } finally { setBusy(false) }
  }

  submitExamRef.current = submitExam

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false)
    await submitExam(false)
  }

  if (!profile || !program) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div role="alert" style={{ padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>Unable to load profile or program. Please complete onboarding first.</span>
        </div>
      </div>
    )
  }

  if (profile.track === 'course') {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Card variant="outlined">
          <CardContent style={{ padding: 48, textAlign: 'center' }}>
            <Icon name="timer" size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px' }}>Mock exams are for board candidates</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted)' }}>
              Timed mock simulations follow the official Pharmacists Licensure Examination Table of Specifications.
              Since you're still studying, practice mode with your own subjects is the better fit.
            </p>
            <Link to="/practice"><Button variant="primary" leftIcon="brain">Go to Practice</Button></Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalDuration = program.mockDurationMinutes * 60
  const elapsed = totalDuration - (remaining ?? 0)
  const progress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0

  // Setup state
  if (!exam) {
    return (
      <div className="container workspace-page">
        <WorkspacePageHeader eyebrow="PhLE BOARD SIMULATION" index="04" title={<>Your <em>PhLE mock exam.</em></>} description="Experience a timed 6-module Pharmacist Licensure Examination simulation weighted to the PRC Table of Specifications. Answers and rationales appear after you submit." />

        {err && (
          <div role="alert" style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="alert-circle" size={20} />
            <span>{err}</span>
          </div>
        )}

        <div className="grid grid-2">
          <Card variant="elevated">
            <CardHeader title={program.name} icon="pill" subtitle={`${program.mockDurationMinutes} minutes • ${program.subjects.length} PhLE modules • ${PASSING_RATE}% overall + no subject below 50%`} />
            <CardContent>
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>PhLE Table of Specifications (TOS)</h4>
                <div className="table-wrapper" role="region" aria-label="PhLE exam specifications, scrollable table" tabIndex={0} style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>PhLE Module</th><th style={{width: 80}}>Items</th><th style={{width: 100}}>Weight</th></tr></thead>
                    <tbody>
                      {program.tos.map(t => {
                        const detail = getSubjectDetail(t.subject)
                        return (
                          <tr key={t.subject}>
                            <td>
                              <div className="subject-cell">
                                {detail && (
                                  <span className="subject-cell-icon" aria-hidden="true">
                                    <Icon name={detail.icon} size={14} />
                                  </span>
                                )}
                                <div>
                                  <div>{t.subject}</div>
                                  {detail && <span className="subject-cell-sub">{detail.moduleCode}</span>}
                                </div>
                              </div>
                            </td>
                            <td style={{fontVariantNumeric: 'tabular-nums', fontWeight: 600}}>{t.items}</td>
                            <td style={{fontVariantNumeric: 'tabular-nums', color: 'var(--muted)'}}>{t.weightPercent}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Button variant="primary" fullWidth size="lg" leftIcon="timer" onClick={startExam} disabled={busy}>
                {busy ? 'Starting…' : 'Start PhLE Mock Exam'}
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
                  <Icon name="target" size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span>Passing requires {PASSING_RATE}% overall and at least 50% in every subject, per RA 10918.</span>
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
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-dim)' }}>Sources &amp; standards.</strong> Subject weights and item
                counts follow the PRC Board of Pharmacy Table of Specifications (PRB Pharmacy Resolution No. 10, s. 2013,
                as used in the official PRC exam program). The passing rule (75% general weighted average, no subject
                below 50% in any subject) follows PRB Pharmacy Resolution No. 01(A), s. 2011, amending Res. No. 86, s. 1986,
                pursuant to RA 10918 (Pharmacy Act). Verify against the latest official PRC board resolution before exam day.
              </div>
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
            <AnimatedNumber value={score} suffix="%" duration={1100} /> — {passed ? 'PASSED' : 'BELOW PASSING RULE'}
          </Badge>
        </div>

        <Card variant="elevated" style={{ marginBottom: 24 }}>
          <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>FINAL SCORE</div>
                <div style={{ fontSize: 48, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--danger)' }}>
                  <AnimatedNumber value={score} suffix="%" duration={1300} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>CORRECT / TOTAL</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  <AnimatedNumber value={items.filter(i => i.is_correct).length} duration={1100} delay={120} /> / {items.length}
                </div>
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
  const resp = it ? responses[it.id] as { selected?: number; text?: string; order?: string[] } | null : null
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
          <div
            className={`timer${remaining != null && remaining < 300 ? ' is-urgent' : ''}`}
            style={{ fontSize: 28, fontWeight: 700, color: remaining != null && remaining < 300 ? 'var(--danger)' : 'var(--primary)' }}
          >
            {remaining != null ? formatTime(remaining) : '--:--:--'}
          </div>
          <ProgressBar value={progress} max={100} size="sm" ariaLabel="Exam time elapsed" variant={remaining != null && remaining < 300 ? 'danger' : 'primary'} style={{ marginTop: 8, width: 160 }} />
        </Card>
      </div>

      {err && (
        <div role="alert" style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>{err}</span>
        </div>
      )}

      {msg && (
        <div role="status" style={{ marginBottom: 16, padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                <Button variant="secondary" size="sm" leftIcon="chevron-left" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} aria-label="Previous question">Previous</Button>
                <Button variant="secondary" size="sm" rightIcon="chevron-right" onClick={() => setCurrent(c => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1} aria-label="Next question">Next</Button>
                <Button variant="danger" size="sm" leftIcon="flag" onClick={() => setShowSubmitConfirm(true)} disabled={busy} aria-label="Submit exam">Submit Exam</Button>
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: resp?.selected === i ? 'var(--primary)' : 'var(--border)', color: resp?.selected === i ? 'var(--on-primary)' : 'var(--muted)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
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
                    aria-label="Your identification"
                    value={resp?.text || ''}
                    onChange={e => setResponse(it.id, { text: e.target.value }, true)}
                    placeholder="Enter the drug class, mechanism, principle, pharmacy law, or formula..."
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 14 }}>{item}</span>
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="ghost" size="icon" onClick={() => moveSeq(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="chevron-up" size={16} aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => moveSeq(i, 1)} disabled={i === seqOrder.length - 1} aria-label="Move down"><Icon name="chevron-down" size={16} aria-hidden="true" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" onClick={() => setResponse(it.id, { order: [...seqOrder] })}>Use this order</Button>
                  {resp?.order && <span style={{ color: 'var(--muted)', fontSize: 12 }}>Order selected for this session</span>}
                </div>
              </>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <Button variant="secondary" leftIcon="chevron-left" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} aria-label="Previous question">Previous</Button>
              <Button variant="secondary" rightIcon="chevron-right" onClick={() => setCurrent(c => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1} aria-label="Next question">Next</Button>
              <Button variant="danger" leftIcon="flag" onClick={() => setShowSubmitConfirm(true)} disabled={busy} aria-label="Submit exam">Submit Exam</Button>
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
                  width: 48, height: 48, borderRadius: 10, border: '2px solid',
                  borderColor: i === current ? 'var(--primary)' : responses[x.id] ? 'var(--success)' : 'var(--border)',
                  background: i === current ? 'var(--primary-bg)' : responses[x.id] ? 'var(--success-bg)' : 'var(--panel-2)',
                  color: i === current ? 'var(--primary)' : responses[x.id] ? 'var(--success)' : 'var(--text)',
                  fontWeight: 600, fontSize: 13, transition: 'all 150ms ease', minWidth: 48
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