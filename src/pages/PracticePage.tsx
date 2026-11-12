import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { checkDiagnosis, checkSequence } from '@/lib/analytics'
import type { Flashcard, McqAnswer, McqQuestion, PracticeItem, PracticeType, SequenceAnswer, SequenceQuestion, DiagnosisAnswer, DiagnosisQuestion } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, EmptyState, SegControl, Tabs, TabPanels, TabPanel, Skeleton, useToast, type TabItem } from '@/components/ui'

export default function PracticePage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const program = profile ? getProgram(profile.board_program) : null
  const [mode, setMode] = useState<'flashcards' | PracticeType>('mcq')
  const [subject, setSubject] = useState<string>('')
  const [items, setItems] = useState<PracticeItem[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [idx, setIdx] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [diagInput, setDiagInput] = useState('')
  const [seqOrder, setSeqOrder] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()

  useEffect(() => { if (program) setSubject(program.subjects[0]) }, [program])

  useEffect(() => {
    if (!profile || !subject) return
    load()
  }, [profile, subject, mode])

  async function load() {
    if (!profile) return
    setLoading(true); setIdx(0); setReveal(false); setFeedback(null); setSelected(null); setDiagInput('')
    if (mode === 'flashcards') {
      const { data } = await supabase.from('flashcards').select('*').eq('user_id', profile.id).eq('subject', subject).limit(50)
      setFlashcards((data as Flashcard[]) || [])
      setItems([])
    } else {
      const { data } = await supabase.from('practice_items').select('*').eq('user_id', profile.id).eq('subject', subject).eq('type', mode).limit(50)
      const list = (data as PracticeItem[]) || []
      setItems(list)
      setFlashcards([])
      if (mode === 'sequence' && list[0]) {
        const q = list[0].question as SequenceQuestion
        setSeqOrder([...(q.items || [])].sort(() => Math.random() - 0.5))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (mode === 'sequence' && items[idx]) {
      const q = items[idx].question as SequenceQuestion
      setSeqOrder([...(q.items || [])].sort(() => Math.random() - 0.5))
      setFeedback(null)
    }
  }, [idx, mode, items])

  const current = useMemo(() => items[idx], [items, idx])
  const currentCard = useMemo(() => flashcards[idx], [flashcards, idx])

  async function recordAttempt(correct: boolean, response: unknown) {
    if (!user || !profile) return
    const it = items[idx]
    await supabase.from('attempts').insert({
      user_id: user.id,
      practice_item_id: it?.id || null,
      board_program: profile.board_program,
      subject,
      type: mode,
      user_response: response,
      is_correct: correct
    })
  }

  async function submitMcq() {
    if (selected == null || !current) return
    const ans = current.answer as McqAnswer
    const correct = selected === ans.correctIndex
    setFeedback({ correct, text: current.rationale || '' })
    await recordAttempt(correct, { selected })
    addToast({ type: correct ? 'success' : 'error', title: correct ? 'Correct!' : 'Incorrect', message: current.rationale || undefined, duration: 3000 })
  }

  async function submitDiagnosis() {
    if (!current) return
    const ans = current.answer as DiagnosisAnswer
    const correct = checkDiagnosis(diagInput, ans.expected, ans.acceptable || [])
    setFeedback({ correct, text: current.rationale || `Expected: ${ans.expected}` })
    await recordAttempt(correct, { text: diagInput })
    addToast({ type: correct ? 'success' : 'error', title: correct ? 'Correct!' : 'Incorrect', message: current.rationale || `Expected: ${ans.expected}`, duration: 3000 })
  }

  async function submitSequence() {
    if (!current) return
    const ans = current.answer as SequenceAnswer
    const correct = checkSequence(seqOrder, ans.order)
    setFeedback({ correct, text: current.rationale || '' })
    await recordAttempt(correct, { order: seqOrder })
    addToast({ type: correct ? 'success' : 'error', title: correct ? 'Correct order!' : 'Incorrect order', message: current.rationale || `Correct: ${ans.order.join(' → ')}`, duration: 3000 })
  }

  function moveSeq(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= seqOrder.length) return
    const copy = [...seqOrder]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setSeqOrder(copy)
  }

  function next() {
    setIdx(i => i + 1)
    setReveal(false); setSelected(null); setDiagInput(''); setFeedback(null)
  }

  if (!profile || !program) return null

  const empty = mode === 'flashcards' ? flashcards.length === 0 : items.length === 0
  const done = mode === 'flashcards' ? idx >= flashcards.length : idx >= items.length

  const modeTabs: TabItem[] = [
    { value: 'flashcards', label: 'Flashcards', icon: 'book-open' },
    { value: 'mcq', label: 'MCQ', icon: 'file-text' },
    { value: 'diagnosis', label: 'Diagnosis', icon: 'brain' },
    { value: 'sequence', label: 'Sequence', icon: 'chevron-up-down' },
  ]

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700 }}>PRC-Style Practice</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>Situational MCQs, case/concept diagnosis, and priority/sequence ordering aligned to your board syllabus.</p>
      </div>

      <Card variant="elevated" style={{ marginBottom: 20 }}>
        <CardContent style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end', marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>MODE</label>
              <Tabs tabs={modeTabs} value={mode} onChange={(v) => setMode(v as 'flashcards' | PracticeType)} variant="pills" fullWidth />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>BOARD SUBJECT</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', color: 'var(--text)', fontSize: 14 }}
              >
                {program.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <Button variant="secondary" leftIcon="refresh-cw" onClick={load} disabled={loading} fullWidth style={{ maxWidth: 200 }}>
            {loading ? 'Loading…' : 'Reload Items'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card variant="outlined">
          <CardContent style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="spin" style={{ width: 40, height: 40 }}><Icon name="loader" size={40} /></div>
              <span style={{ color: 'var(--muted)' }}>Loading practice items...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && empty && (
        <Card variant="outlined">
          <CardContent style={{ padding: 48 }}>
            <EmptyState
              icon={mode === 'flashcards' ? 'book-open' : 'file-text'}
              title="No items found"
              description={`No ${mode === 'flashcards' ? 'flashcards' : `${mode.toUpperCase()} questions`} available for this subject. Generate them in Reviewer & Generate.`}
              action={{ label: 'Go to Reviewer', onClick: () => navigate('/reviewer'), variant: 'primary' }}
            />
          </CardContent>
        </Card>
      )}

      {!loading && !empty && done && (
        <Card variant="outlined" style={{ borderColor: 'var(--success-border)', background: 'var(--success-bg)' }}>
          <CardContent style={{ padding: 32, textAlign: 'center' }}>
            <Icon name="check-circle" size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px' }}>Session Complete</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Reload to practice again or choose another subject/mode.</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button variant="primary" leftIcon="rotate-ccw" onClick={load}>Practice Again</Button>
              <Button variant="secondary" onClick={() => setSubject(program.subjects[0])}>Change Subject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flashcards Mode */}
      {!loading && !empty && !done && mode === 'flashcards' && currentCard && (
        <Card variant="elevated">
          <CardContent style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <Badge variant="primary" size="sm">Card {idx + 1} of {flashcards.length} — {currentCard.subject}</Badge>
            </div>
            <div
              className="flashcard"
              style={{
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                borderRadius: 16,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                marginBottom: 24,
              }}
            >
              <div style={{ maxWidth: 500 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                  {reveal ? 'Answer' : 'Prompt'}
                </div>
                <div style={{ fontSize: 20, lineHeight: 1.6, fontWeight: 500 }}>
                  {reveal ? currentCard.back : currentCard.front}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant="secondary" size="lg" leftIcon={reveal ? 'chevron-left' : 'eye'} onClick={() => setReveal(r => !r)}>
                {reveal ? 'Show Prompt' : 'Reveal Answer'}
              </Button>
              <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MCQ Mode */}
      {!loading && !empty && !done && current && mode === 'mcq' && (
        <Card variant="elevated">
          <CardContent style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge variant="primary" size="md">Item {idx + 1} of {items.length} — {current.subject} — PRC Situational MCQ</Badge>
            </div>

            <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{(current.question as McqQuestion).stem}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(current.question as McqQuestion).options.map((opt, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderRadius: 10, border: '2px solid',
                  borderColor: selected === i ? 'var(--primary)' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? 'var(--success)' : selected === i ? 'var(--danger)' : 'var(--border)') : 'var(--border)',
                  background: selected === i ? 'var(--primary-bg)' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? 'var(--success-bg)' : selected === i ? 'var(--danger-bg)' : 'var(--panel-2)') : 'var(--panel-2)',
                  cursor: feedback ? 'default' : 'pointer',
                  transition: 'all 150ms ease',
                  opacity: feedback && selected !== i && i !== (current.answer as McqAnswer).correctIndex ? 0.5 : 1,
                }}>
                  <input type="radio" name="mcq" checked={selected === i} onChange={() => !feedback && setSelected(i)} disabled={!!feedback} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: selected === i ? 'var(--primary)' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? 'var(--success)' : selected === i ? 'var(--danger)' : 'var(--border)') : 'var(--border)', color: selected === i ? '#041014' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? '#fff' : selected === i ? '#fff' : 'var(--muted)') : 'var(--muted)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ flex: 1, fontSize: 14 }}>{opt}</span>
                  {feedback && i === (current.answer as McqAnswer).correctIndex && <Icon name="check-circle" size={18} style={{ color: 'var(--success)' }} />}
                  {feedback && selected === i && i !== (current.answer as McqAnswer).correctIndex && <Icon name="x-circle" size={18} style={{ color: 'var(--danger)' }} />}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitMcq} disabled={selected == null} fullWidth style={{ maxWidth: 200 }}>Submit</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 200 }}>Next</Button>
              )}
            </div>

            {feedback && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: `1px solid ${feedback.correct ? 'var(--success-border)' : 'var(--danger-border)'}`, background: feedback.correct ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} style={{ color: feedback.correct ? 'var(--success)' : 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: feedback.correct ? 'var(--success)' : 'var(--danger)' }}>
                      {feedback.correct ? 'Correct.' : 'Incorrect.'}
                    </div>
                    <div style={{ marginTop: 8, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      <strong>Rationale:</strong> {feedback.text}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Mode */}
      {!loading && !empty && !done && current && mode === 'diagnosis' && (
        <Card variant="elevated">
          <CardContent style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge variant="primary" size="md">Item {idx + 1} of {items.length} — {current.subject} — Case & Concept Diagnosis</Badge>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Scenario</div>
              <div style={{ padding: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12, lineHeight: 1.7 }}>
                {(current.question as DiagnosisQuestion).scenario}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Prompt</div>
              <div style={{ padding: 16, background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 10, fontWeight: 500, fontSize: 15 }}>
                {(current.question as DiagnosisQuestion).prompt}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Your Identification</label>
              <input
                value={diagInput}
                onChange={e => setDiagInput(e.target.value)}
                placeholder="Enter the exact concept/principle/law/formula..."
                disabled={!!feedback}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: `1px solid ${feedback ? (feedback.correct ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`, background: 'var(--panel-2)', color: 'var(--text)', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitDiagnosis} disabled={!diagInput} fullWidth style={{ maxWidth: 200 }}>Submit</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 200 }}>Next</Button>
              )}
            </div>

            {feedback && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: `1px solid ${feedback.correct ? 'var(--success-border)' : 'var(--danger-border)'}`, background: feedback.correct ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} style={{ color: feedback.correct ? 'var(--success)' : 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: feedback.correct ? 'var(--success)' : 'var(--danger)' }}>
                      {feedback.correct ? 'Correct.' : 'Incorrect.'}
                    </div>
                    <div style={{ marginTop: 8, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      <strong>Rationale / Expected:</strong> {feedback.text}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sequence Mode */}
      {!loading && !empty && !done && current && mode === 'sequence' && (
        <Card variant="elevated">
          <CardContent style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge variant="primary" size="md">Item {idx + 1} of {items.length} — {current.subject} — Priority & Sequence Ordering</Badge>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>{(current.question as SequenceQuestion).prompt}</h3>
            <p className="muted" style={{ marginBottom: 20 }}>Arrange items in the correct chronological/priority order (top = first).</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seqOrder.map((item, i) => (
                <div key={item + i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', gap: 12
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: '#041014', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 15 }}>{item}</span>
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="ghost" size="icon" onClick={() => !feedback && moveSeq(i, -1)} disabled={i === 0 || !!feedback}><Icon name="chevron-up" size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => !feedback && moveSeq(i, 1)} disabled={i === seqOrder.length - 1 || !!feedback}><Icon name="chevron-down" size={16} /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitSequence} fullWidth style={{ maxWidth: 200 }}>Submit Order</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 200 }}>Next</Button>
              )}
            </div>

            {feedback && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: `1px solid ${feedback.correct ? 'var(--success-border)' : 'var(--danger-border)'}`, background: feedback.correct ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} style={{ color: feedback.correct ? 'var(--success)' : 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: feedback.correct ? 'var(--success)' : 'var(--danger)' }}>
                      {feedback.correct ? 'Correct order.' : 'Incorrect order.'}
                    </div>
                    <div style={{ marginTop: 8, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      <strong>Rationale:</strong> {feedback.text}
                    </div>
                    {!feedback.correct && (
                      <div style={{ marginTop: 8, padding: 12, background: 'var(--panel-2)', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <strong style={{ color: 'var(--success)' }}>Correct order:</strong> <span style={{ marginLeft: 8 }}>{(current.answer as SequenceAnswer).order.join(' → ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}