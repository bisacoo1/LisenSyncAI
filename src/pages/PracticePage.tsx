import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { checkDiagnosis, checkSequence } from '@/lib/analytics'
import type { Flashcard, McqAnswer, McqQuestion, PracticeItem, PracticeType, SequenceAnswer, SequenceQuestion, DiagnosisAnswer, DiagnosisQuestion } from '@/types'

export default function PracticePage() {
  const { profile, user } = useAuth()
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

  useEffect(() => { if (program) setSubject(program.subjects[0]) }, [program])

  useEffect(() => {
    if (!profile || !subject) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }

  async function submitDiagnosis() {
    if (!current) return
    const ans = current.answer as DiagnosisAnswer
    const correct = checkDiagnosis(diagInput, ans.expected, ans.acceptable || [])
    setFeedback({ correct, text: current.rationale || `Expected: ${ans.expected}` })
    await recordAttempt(correct, { text: diagInput })
  }

  async function submitSequence() {
    if (!current) return
    const ans = current.answer as SequenceAnswer
    const correct = checkSequence(seqOrder, ans.order)
    setFeedback({ correct, text: current.rationale || '' })
    await recordAttempt(correct, { order: seqOrder })
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

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="section-title">PRC-Style Practice</h1>
          <p className="muted">Situational MCQs, case/concept diagnosis, and priority/sequence ordering aligned to your board syllabus.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="field">
            <label>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as any)}>
              <option value="flashcards">Flashcards (Active Recall)</option>
              <option value="mcq">PRC-Style Situational MCQ</option>
              <option value="diagnosis">Case & Concept Diagnosis</option>
              <option value="sequence">Priority & Sequence Ordering</option>
            </select>
          </div>
          <div className="field">
            <label>Board Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {program.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button className="btn secondary" onClick={load} disabled={loading}>Reload Items</button>
      </div>

      {loading && <div className="card">Loading…</div>}
      {!loading && empty && <div className="card">No items found for this mode/subject. Generate them in <strong>Reviewer & Generate</strong>.</div>}
      {!loading && !empty && done && <div className="card success">Session complete. Reload to practice again or choose another subject/mode.</div>}

      {!loading && !empty && !done && mode === 'flashcards' && currentCard && (
        <div className="card">
          <div className="muted">Card {idx + 1} of {flashcards.length} — {currentCard.subject}</div>
          <div className="flashcard" style={{ margin: '16px 0' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{reveal ? 'Answer' : 'Prompt'}</div>
              <div>{reveal ? currentCard.back : currentCard.front}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => setReveal(r => !r)}>{reveal ? 'Show Prompt' : 'Reveal Answer'}</button>
            <button className="btn" onClick={next}>Next</button>
          </div>
        </div>
      )}

      {!loading && !empty && !done && current && mode === 'mcq' && (
        <div className="card">
          <div className="muted">Item {idx + 1} of {items.length} — {current.subject} — PRC Situational MCQ</div>
          <h3 style={{ marginTop: 8 }}>{(current.question as McqQuestion).stem}</h3>
          <div className="grid" style={{ marginTop: 12 }}>
            {(current.question as McqQuestion).options.map((opt, i) => (
              <label key={i} className="pill" style={{ display: 'block', cursor: 'pointer', borderColor: selected === i ? 'var(--primary)' : undefined }}>
                <input type="radio" name="mcq" checked={selected === i} onChange={() => setSelected(i)} /> {String.fromCharCode(65 + i)}. {opt}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitMcq} disabled={selected == null || !!feedback}>Submit</button>
            {feedback && <button className="btn secondary" onClick={next}>Next</button>}
          </div>
          {feedback && (
            <div className={feedback.correct ? 'success' : 'error'} style={{ marginTop: 12 }}>
              <strong>{feedback.correct ? 'Correct.' : 'Incorrect.'}</strong>
              <div style={{ marginTop: 6 }}><strong>Rationale:</strong> {feedback.text}</div>
            </div>
          )}
        </div>
      )}

      {!loading && !empty && !done && current && mode === 'diagnosis' && (
        <div className="card">
          <div className="muted">Item {idx + 1} of {items.length} — {current.subject} — Case & Concept Diagnosis</div>
          <h3 style={{ marginTop: 8 }}>Scenario</h3>
          <p>{(current.question as DiagnosisQuestion).scenario}</p>
          <p><strong>{(current.question as DiagnosisQuestion).prompt}</strong></p>
          <div className="field">
            <label>Your identification (principle, disease, law, or formula)</label>
            <input value={diagInput} onChange={e => setDiagInput(e.target.value)} placeholder="Enter the exact concept/principle/law/formula..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitDiagnosis} disabled={!diagInput || !!feedback}>Submit</button>
            {feedback && <button className="btn secondary" onClick={next}>Next</button>}
          </div>
          {feedback && (
            <div className={feedback.correct ? 'success' : 'error'} style={{ marginTop: 12 }}>
              <strong>{feedback.correct ? 'Correct.' : 'Incorrect.'}</strong>
              <div style={{ marginTop: 6 }}><strong>Rationale / Expected:</strong> {feedback.text}</div>
            </div>
          )}
        </div>
      )}

      {!loading && !empty && !done && current && mode === 'sequence' && (
        <div className="card">
          <div className="muted">Item {idx + 1} of {items.length} — {current.subject} — Priority & Sequence Ordering</div>
          <h3 style={{ marginTop: 8 }}>{(current.question as SequenceQuestion).prompt}</h3>
          <p className="muted">Arrange items in the correct chronological/priority order (top = first).</p>
          <div className="grid">
            {seqOrder.map((item, i) => (
              <div key={item + i} className="pill" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span><strong>{i + 1}.</strong> {item}</span>
                <span>
                  <button className="btn secondary" onClick={() => moveSeq(i, -1)} disabled={i === 0 || !!feedback}>↑</button>{' '}
                  <button className="btn secondary" onClick={() => moveSeq(i, 1)} disabled={i === seqOrder.length - 1 || !!feedback}>↓</button>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submitSequence} disabled={!!feedback}>Submit Order</button>
            {feedback && <button className="btn secondary" onClick={next}>Next</button>}
          </div>
          {feedback && (
            <div className={feedback.correct ? 'success' : 'error'} style={{ marginTop: 12 }}>
              <strong>{feedback.correct ? 'Correct order.' : 'Incorrect order.'}</strong>
              <div style={{ marginTop: 6 }}><strong>Rationale:</strong> {feedback.text}</div>
              {!feedback.correct && <div style={{ marginTop: 6 }}><strong>Correct order:</strong> {(current.answer as SequenceAnswer).order.join(' → ')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
