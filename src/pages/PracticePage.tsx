import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { generateStudyHint } from '@/lib/ai'
import { checkDiagnosis, checkEnumeration, checkSequence, computeProfileStatsUpdate } from '@/lib/analytics'
import { isCardDue, scheduleReview, type ReviewQuality } from '@/lib/srs'
import type { Flashcard, McqAnswer, McqQuestion, PracticeItem, PracticeType, SequenceAnswer, SequenceQuestion, DiagnosisAnswer, DiagnosisQuestion, EnumerationAnswer, Profile } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, EmptyState, Tabs, useToast, type TabItem } from '@/components/ui'
import LevelUpCelebration from '@/components/LevelUpCelebration'
import AiHelper from '@/components/AiHelper'
import LiloSpeechPanel from '@/components/LiloSpeechPanel'

export default function PracticePage() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const program = profile ? getProgram(profile.board_program) : null
  const [mode, setMode] = useState<'flashcards' | PracticeType>('mcq')
  const [subject, setSubject] = useState<string>('')
  const [materialId, setMaterialId] = useState('')
  const [items, setItems] = useState<PracticeItem[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [idx, setIdx] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [diagInput, setDiagInput] = useState('')
  const [seqOrder, setSeqOrder] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const loadRequest = useRef(0)
  const hintRequest = useRef(0)
  const [hints, setHints] = useState<string[]>([])
  const [hintLoading, setHintLoading] = useState(false)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const { addToast } = useToast()
  const isCourse = profile?.track === 'course'

  useEffect(() => {
    const qpMode = searchParams.get('mode')
    const qpSubject = searchParams.get('subject')
    if (qpMode && ['flashcards', 'mcq', 'diagnosis', 'sequence', 'enumeration', 'identification'].includes(qpMode)) {
      setMode(qpMode as 'flashcards' | PracticeType)
    } else {
      setMode('mcq')
    }
    setSubject(qpSubject || '')
    setMaterialId(searchParams.get('material') || '')
  }, [searchParams])

  useEffect(() => {
    if (!profile || !subject) return
    load()
    return () => { loadRequest.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, subject, mode, materialId])

  async function load() {
    if (!profile) return
    const request = ++loadRequest.current
    setLoading(true); setIdx(0); setReveal(false); setFeedback(null); setSelected(null); setDiagInput('')
    if (mode === 'flashcards') {
      let query = supabase.from('flashcards').select('*').eq('user_id', profile.id).eq('subject', subject)
      if (materialId) query = query.eq('material_id', materialId)
      const { data } = await query.order('next_review_at', { ascending: true, nullsFirst: true }).limit(50)
      if (request !== loadRequest.current) return
      setFlashcards((data as Flashcard[]) || [])
      setItems([])
    } else {
      let query = supabase.from('practice_items').select('*').eq('user_id', profile.id).eq('subject', subject).eq('type', mode)
      if (materialId) query = query.eq('material_id', materialId)
      const { data } = await query.limit(50)
      if (request !== loadRequest.current) return
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
    if (mode === 'sequence' && items[idx]?.type === 'sequence') {
      const q = items[idx].question as SequenceQuestion
      setSeqOrder([...(q.items || [])].sort(() => Math.random() - 0.5))
      setFeedback(null)
    }
  }, [idx, mode, items])

  // The selected mode can change before its new items finish loading. Never
  // render an item from the previous mode as if it had the new question shape.
  const current = useMemo(() => {
    const item = items[idx]
    return item?.type === mode && item.subject === subject && (!materialId || item.material_id === materialId) ? item : undefined
  }, [items, idx, mode, subject, materialId])
  const currentCard = useMemo(() => {
    const card = flashcards[idx]
    return card?.subject === subject && (!materialId || card.material_id === materialId) ? card : undefined
  }, [flashcards, idx, subject, materialId])
  const hintKey = `${mode}:${subject}:${materialId}:${idx}:${current?.id || currentCard?.id || ''}`

  useEffect(() => {
    hintRequest.current += 1
    setHints([])
    setHintLoading(false)
    return () => { hintRequest.current += 1 }
  }, [hintKey])

  function selectMode(value: string) {
    const nextMode = value as 'flashcards' | PracticeType
    setMode(nextMode)
    const params = new URLSearchParams(searchParams)
    params.set('mode', nextMode)
    if (subject) params.set('subject', subject)
    if (materialId) params.set('material', materialId)
    setSearchParams(params, { replace: true })
  }

  async function bumpProfileStats(isCorrect: boolean) {
    if (!user || !profile) return
    try {
      const { data: fresh, error: readError } = await supabase.from('profiles').select('*').eq('id', profile.id).single()
      if (readError) throw new Error(readError.message)
      const today = new Date().toISOString().slice(0, 10)
      const updates = computeProfileStatsUpdate((fresh as Profile) || profile, isCorrect, today)
      if ((updates.level ?? 0) > ((fresh as Profile).level ?? 1)) {
        setLevelUp(updates.level ?? null)
      }
      const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', profile.id)
      if (updateError) throw new Error(updateError.message)
      await refreshProfile()
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not save progress', message: e.message })
    }
  }

  async function recordAttempt(correct: boolean, response: unknown) {
    if (!user || !profile || !program) return
    try {
      const it = items[idx]
      const { error: attemptError } = await supabase.from('attempts').insert({
        user_id: user.id,
        practice_item_id: it?.id || null,
        board_program: program.key,
        subject,
        type: mode,
        user_response: response,
        is_correct: correct
      })
      if (attemptError) throw new Error(attemptError.message)
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not save progress', message: e.message })
      return
    }
    await bumpProfileStats(correct)
  }

  async function rateCard(quality: ReviewQuality) {
    if (!currentCard || !profile) return
    const sched = scheduleReview(currentCard, quality)
    const { error } = await supabase.from('flashcards').update(sched).eq('id', currentCard.id)
    if (error) {
      addToast({ type: 'error', title: 'Could not save review', message: error.message })
      return
    }
    setFlashcards(prev => prev.map(c => (c.id === currentCard.id ? { ...c, ...sched } : c)))
    await bumpProfileStats(quality !== 'again')
    next()
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

  async function submitIdentification() {
    if (!current) return
    const ans = current.answer as DiagnosisAnswer
    const correct = checkDiagnosis(diagInput, ans.expected, ans.acceptable || [])
    setFeedback({ correct, text: current.rationale || `Expected: ${ans.expected}` })
    await recordAttempt(correct, { text: diagInput })
    addToast({ type: correct ? 'success' : 'error', title: correct ? 'Correct!' : 'Incorrect', message: current.rationale || `Expected: ${ans.expected}`, duration: 3000 })
  }

  async function submitEnumeration() {
    if (!current) return
    const ans = current.answer as EnumerationAnswer
    const correct = checkEnumeration(diagInput, ans.items || [])
    setFeedback({ correct, text: current.rationale || `Expected items: ${(ans.items || []).join(', ')}` })
    await recordAttempt(correct, { text: diagInput })
    addToast({ type: correct ? 'success' : 'error', title: correct ? 'Correct!' : 'Incorrect', message: current.rationale || `Expected: ${(ans.items || []).join(', ')}`, duration: 3000 })
  }

  function questionContext(includeAnswer = true): string {
    const it = current
    if (!it) return ''
    const subj = `Board subject: ${it.subject}`
    if (mode === 'mcq') {
      const q = it.question as McqQuestion
      const a = it.answer as McqAnswer
      const answer = includeAnswer
        ? `\nCorrect answer: ${String.fromCharCode(65 + a.correctIndex)} — ${q.options[a.correctIndex]}\nRationale: ${it.rationale || 'none'}`
        : ''
      return `${subj}\nQuestion: ${q.stem}\nOptions:\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}${answer}`
    }
    if (mode === 'diagnosis') {
      const q = it.question as DiagnosisQuestion
      const a = it.answer as DiagnosisAnswer
      const answer = includeAnswer
        ? `\nExpected answer: ${a.expected}${a.acceptable?.length ? ` (also acceptable: ${a.acceptable.join(', ')})` : ''}\nRationale: ${it.rationale || 'none'}`
        : ''
      return `${subj}\nScenario: ${q.scenario}\nPrompt: ${q.prompt}${answer}`
    }
    if (mode === 'sequence') {
      const q = it.question as SequenceQuestion
      const a = it.answer as SequenceAnswer
      const answer = includeAnswer ? `\nCorrect order: ${a.order.join(' → ')}\nRationale: ${it.rationale || 'none'}` : ''
      return `${subj}\nPrompt: ${q.prompt}\nItems: ${q.items.join(' | ')}${answer}`
    }
    if (mode === 'enumeration') {
      const q = it.question as DiagnosisQuestion
      const a = it.answer as EnumerationAnswer
      const answer = includeAnswer ? `\nExpected items: ${(a.items || []).join(', ')}\nRationale: ${it.rationale || 'none'}` : ''
      return `${subj}\nPrompt: ${q.prompt}${answer}`
    }
    if (mode === 'identification') {
      const q = it.question as DiagnosisQuestion
      const a = it.answer as DiagnosisAnswer
      const answer = includeAnswer
        ? `\nExpected answer: ${a.expected}${a.acceptable?.length ? ` (also acceptable: ${a.acceptable.join(', ')})` : ''}\nRationale: ${it.rationale || 'none'}`
        : ''
      return `${subj}\nScenario: ${q.scenario}\nPrompt: ${q.prompt}${answer}`
    }
    return ''
  }

  function hintBlockedAnswers(): string[] {
    if (mode === 'flashcards') return currentCard ? [currentCard.back] : []
    if (!current) return []
    if (mode === 'mcq') {
      const question = current.question as McqQuestion
      const answer = current.answer as McqAnswer
      return [question.options[answer.correctIndex] || '']
    }
    if (mode === 'diagnosis' || mode === 'identification') {
      const answer = current.answer as DiagnosisAnswer
      return [answer.expected, ...(answer.acceptable || [])]
    }
    if (mode === 'sequence') {
      const answer = current.answer as SequenceAnswer
      return [answer.order.join(' | ')]
    }
    if (mode === 'enumeration') {
      const answer = current.answer as EnumerationAnswer
      return answer.items || []
    }
    return []
  }

  async function requestHint() {
    if (!program || hintLoading || hints.length >= 2) return
    const contextText = mode === 'flashcards' ? currentCard?.front || '' : questionContext(false)
    if (!contextText.trim()) return
    const request = ++hintRequest.current
    setHintLoading(true)
    try {
      const hint = await generateStudyHint({
        contextText,
        program: program.key,
        subject,
        previousHints: hints,
        forbiddenAnswers: hintBlockedAnswers(),
      })
      if (request === hintRequest.current) setHints(previous => [...previous, hint])
    } catch (error) {
      if (request === hintRequest.current) {
        addToast({
          type: 'error',
          title: 'Hint unavailable',
          message: error instanceof Error ? error.message : 'Please try again.',
        })
      }
    } finally {
      if (request === hintRequest.current) setHintLoading(false)
    }
  }

  function studySpeechText(): string {
    if (mode === 'flashcards') {
      if (!currentCard) return ''
      return reveal
        ? `Flashcard: ${currentCard.front}. Answer: ${currentCard.back}`
        : `Flashcard: ${currentCard.front}`
    }
    if (!current) return ''

    if (mode === 'mcq') {
      const question = current.question as McqQuestion
      const options = question.options
        .map((option, index) => `Option ${String.fromCharCode(65 + index)}: ${option}`)
        .join('. ')
      const answer = current.answer as McqAnswer
      const feedbackText = feedback
        ? `The correct answer is ${String.fromCharCode(65 + answer.correctIndex)}: ${question.options[answer.correctIndex]}. ${current.rationale || feedback.text}`
        : ''
      return `${question.stem}. ${options}. ${feedbackText}`.trim()
    }

    if (mode === 'sequence') {
      const question = current.question as SequenceQuestion
      const answer = current.answer as SequenceAnswer
      return [
        question.prompt,
        `Items: ${question.items.join(', ')}.`,
        feedback ? `The correct order is ${answer.order.join(', ')}. ${current.rationale || feedback.text}` : '',
      ].filter(Boolean).join(' ')
    }

    if (mode === 'enumeration') {
      const question = current.question as DiagnosisQuestion
      const answer = current.answer as EnumerationAnswer
      return [
        question.prompt,
        feedback ? `The expected items are ${(answer.items || []).join(', ')}. ${current.rationale || feedback.text}` : '',
      ].filter(Boolean).join(' ')
    }

    const question = current.question as DiagnosisQuestion
    const answer = current.answer as DiagnosisAnswer
    return [
      question.scenario,
      question.prompt,
      feedback ? `The expected answer is ${answer.expected}. ${current.rationale || feedback.text}` : '',
    ].filter(Boolean).join(' ')
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

  const empty = !subject || (mode === 'flashcards' ? flashcards.length === 0 : items.length === 0)
  const done = Boolean(subject) && (mode === 'flashcards' ? idx >= flashcards.length : idx >= items.length)

  const modeTabs: TabItem[] = isCourse ? [
    { value: 'flashcards', label: 'Flashcards', icon: 'book-open' },
    { value: 'mcq', label: 'Multiple Choice', icon: 'file-text' },
    { value: 'enumeration', label: 'Enumeration', icon: 'list-checks' },
    { value: 'identification', label: 'Identification', icon: 'search' },
  ] : [
    { value: 'flashcards', label: 'Flashcards', icon: 'book-open' },
    { value: 'mcq', label: 'MCQ', icon: 'file-text' },
    { value: 'diagnosis', label: 'Diagnosis', icon: 'brain' },
    { value: 'sequence', label: 'Sequence', icon: 'chevron-up-down' },
  ]
  const sessionLength = mode === 'flashcards' ? flashcards.length : items.length
  const sessionProgress = sessionLength ? Math.round(((idx + 1) / sessionLength) * 100) : 0
  const sessionLabel = mode === 'flashcards' ? 'Card' : 'Question'
  const selectedModeLabel = modeTabs.find(tab => tab.value === mode)?.label || 'Practice'
  const speechContextKey = `${mode}:${subject}:${materialId}:${idx}:${current?.id ?? currentCard?.id ?? ''}:${reveal}:${Boolean(feedback)}`
  return (
    <div className="container workspace-page practice-page">
      <header className="practice-focus-header">
        <Button className="practice-exit-button" variant="ghost" leftIcon="arrow-left" onClick={() => navigate('/reviewers')}>
          Browse reviewers
        </Button>
        <div className="practice-focus-title">
          <span>FOCUSED STUDY</span>
          <h1>Practice</h1>
        </div>
      </header>

      <Card variant="elevated" className="practice-controls-card">
        <CardContent className="practice-controls-content">
          <div className="practice-controls-grid">
            <div className="practice-mode-control">
              <span className="practice-control-label">STUDY MODE</span>
              <Tabs className="practice-mode-tabs" tabs={modeTabs} value={mode} onChange={selectMode} variant="scrollable" ariaLabel="Practice mode" fullWidth />
              <span className="practice-scroll-hint">Scroll for more modes <Icon name="arrow-right" size={13} /></span>
            </div>
          </div>
          {subject && (
            <Button className="practice-reload-button" variant="secondary" leftIcon="refresh-cw" onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Reload Items'}
            </Button>
          )}
        </CardContent>
      </Card>

      {!loading && !empty && !done && (
        <section className="practice-session-progress" aria-label={`${selectedModeLabel} session progress`}>
          <div className="practice-session-progress-copy">
            <span>{selectedModeLabel}</span>
            <span>{sessionLabel} {idx + 1} of {sessionLength}</span>
          </div>
          <div
            className="practice-progress-track"
            role="progressbar"
            aria-label={`${selectedModeLabel} progress`}
            aria-valuemin={0}
            aria-valuemax={sessionLength}
            aria-valuenow={idx + 1}
          >
            <span style={{ width: `${sessionProgress}%` }} />
          </div>
        </section>
      )}

      <div className="practice-session-panel" role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`} tabIndex={0}>
      <div className="practice-session-content">
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

      {!loading && !subject && (
        <Card variant="outlined">
          <CardContent>
            <EmptyState
              icon="book-open"
              title="Choose a study set"
              description="Open a subject folder to choose from the flashcards and practice sets you have available."
              action={{ label: 'Browse reviewers', onClick: () => navigate('/reviewers'), variant: 'primary' }}
            />
          </CardContent>
        </Card>
      )}

      {!loading && subject && empty && (
        <Card variant="outlined">
          <CardContent>
            <EmptyState
              icon={mode === 'flashcards' ? 'book-open' : 'file-text'}
              title="No items found"
              description={`No ${mode === 'flashcards' ? 'flashcards' : `${mode.toUpperCase()} questions`} are available for ${subject} yet. Choose another available set or upload a reviewer to generate more.`}
              action={{ label: 'Browse reviewers', onClick: () => navigate('/reviewers'), variant: 'primary' }}
            />
          </CardContent>
        </Card>
      )}

      {!loading && !empty && done && (
        <Card variant="outlined" style={{ borderColor: 'var(--success-border)', background: 'var(--success-bg)' }}>
          <CardContent style={{ padding: 32, textAlign: 'center' }}>
            <Icon name="check-circle" size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px' }}>Session Complete</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Reload to practice again or browse your reviewer folders for another set.</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button variant="primary" leftIcon="rotate-ccw" onClick={load}>Practice Again</Button>
              <Button variant="secondary" onClick={() => navigate('/reviewers')}>Browse another set</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flashcards Mode */}
      {!loading && !empty && !done && mode === 'flashcards' && currentCard && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="sm">{currentCard.subject}</Badge>
              {isCardDue(currentCard) ? (
                <Badge variant="warning" size="sm" dot>Due for review</Badge>
              ) : currentCard.next_review_at ? (
                <Badge variant="default" size="sm">Next: {new Date(currentCard.next_review_at).toLocaleDateString()}</Badge>
              ) : null}
              {(currentCard.repetitions ?? 0) > 0 && (
                <Badge variant="default" size="sm">Seen {currentCard.repetitions}×</Badge>
              )}
            </div>
            <div className={`practice-flashcard${reveal ? ' is-revealed' : ''}`}>
              <Icon name={reveal ? 'sparkles' : 'help-circle'} size={30} aria-hidden="true" />
              <div className="practice-flashcard-label">{reveal ? 'Answer' : 'Prompt'}</div>
              <p className="practice-flashcard-text">{reveal ? currentCard.back : currentCard.front}</p>
              {!reveal && <p className="practice-flashcard-hint">Try to recall the answer, then reveal it.</p>}
            </div>
            <div className="practice-answer-actions">
              <Button variant="secondary" size="lg" leftIcon={reveal ? 'chevron-left' : 'eye'} onClick={() => setReveal(r => !r)}>
                {reveal ? 'Show Prompt' : 'Reveal Answer'}
              </Button>
              {reveal ? (
                <>
                  <Button variant="danger" size="lg" onClick={() => rateCard('again')}>Again</Button>
                  <Button variant="secondary" size="lg" onClick={() => rateCard('hard')}>Hard</Button>
                  <Button variant="primary" size="lg" onClick={() => rateCard('good')}>Good</Button>
                  <Button variant="primary" size="lg" onClick={() => rateCard('easy')}>Easy</Button>
                </>
              ) : (
                <Button variant="outline" size="lg" rightIcon="chevron-right" onClick={next}>
                  Skip card
                </Button>
              )}
            </div>
            {reveal && (
              <p className="practice-rating-hint">
                Rate how well you remembered it to schedule the next review.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* MCQ Mode */}
      {!loading && !empty && !done && current && mode === 'mcq' && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="md">{current.subject} · Multiple choice</Badge>
            </div>

            <h3 className="practice-question-heading">{(current.question as McqQuestion).stem}</h3>

            <fieldset className="practice-answer-fieldset">
              <legend className="practice-visually-hidden">
                Question {idx + 1} of {items.length}: Choose the best answer
              </legend>
              <div className="practice-answer-options">
                {(current.question as McqQuestion).options.map((opt, i) => (
                  <label key={i} className="practice-answer-option" style={{
                    borderColor: selected === i ? 'var(--primary)' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? 'var(--success)' : selected === i ? 'var(--danger)' : 'var(--border)') : 'var(--border)',
                    background: selected === i ? 'var(--primary-bg)' : feedback ? (i === (current.answer as McqAnswer).correctIndex ? 'var(--success-bg)' : selected === i ? 'var(--danger-bg)' : 'var(--panel-2)') : 'var(--panel-2)',
                    cursor: feedback ? 'default' : 'pointer',
                    opacity: feedback && selected !== i && i !== (current.answer as McqAnswer).correctIndex ? 0.5 : 1,
                  }}>
                    <input type="radio" name={`mcq-${current.id}`} checked={selected === i} onChange={() => !feedback && setSelected(i)} disabled={!!feedback} />
                    <span className="practice-answer-letter" style={{
                      background: selected === i ? 'var(--primary)' : feedback && i === (current.answer as McqAnswer).correctIndex ? 'var(--success)' : 'var(--border)',
                      color: selected === i || (feedback && i === (current.answer as McqAnswer).correctIndex) ? '#fff' : 'var(--muted)',
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="practice-answer-copy">{opt}</span>
                    {feedback && i === (current.answer as McqAnswer).correctIndex && <Icon name="check-circle" size={18} style={{ color: 'var(--success)' }} />}
                    {feedback && selected === i && i !== (current.answer as McqAnswer).correctIndex && <Icon name="x-circle" size={18} style={{ color: 'var(--danger)' }} />}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="practice-submit-actions">
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitMcq} disabled={selected == null} fullWidth style={{ maxWidth: 240 }}>Check answer</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 240 }}>Next question</Button>
              )}
            </div>

            {feedback && (
              <div className="practice-feedback" data-correct={feedback.correct}>
                <div className="practice-feedback-icon">
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} />
                </div>
                <div className="practice-feedback-copy">
                  <div className="practice-feedback-title">
                    {feedback.correct ? 'Correct.' : 'Incorrect.'}
                  </div>
                  <div className="practice-feedback-text">
                    <strong>Rationale:</strong> {feedback.text}
                  </div>
                </div>
              </div>
            )}
            {feedback && <AiHelper contextText={questionContext()} program={program.key} subject={subject} itemKey={current.id} />}
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Mode */}
      {!loading && !empty && !done && current && mode === 'diagnosis' && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="md">{current.subject} · Clinical &amp; Concept Diagnosis</Badge>
            </div>

            <div className="practice-content-block">
              <div className="practice-field-label">Scenario</div>
              <div className="practice-context">{(current.question as DiagnosisQuestion).scenario}</div>
            </div>

            <div className="practice-content-block">
              <div className="practice-field-label">Prompt</div>
              <div className="practice-prompt">{(current.question as DiagnosisQuestion).prompt}</div>
            </div>

            <div className="practice-content-block">
              <label htmlFor="diagnosis-input" className="practice-field-label">Your Identification</label>
              <input
                id="diagnosis-input"
                value={diagInput}
                onChange={e => setDiagInput(e.target.value)}
                placeholder="Identify the drug class, mechanism, disease, principle, or pharmacy law..."
                disabled={!!feedback}
                className="practice-answer-input"
                aria-describedby={feedback ? 'practice-feedback' : undefined}
              />
            </div>

            <div className="practice-submit-actions">
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitDiagnosis} disabled={!diagInput} fullWidth style={{ maxWidth: 240 }}>Check answer</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 240 }}>Next question</Button>
              )}
            </div>

            {feedback && (
              <div className="practice-feedback" data-correct={feedback.correct} id="practice-feedback">
                <div className="practice-feedback-icon">
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} />
                </div>
                <div className="practice-feedback-copy">
                  <div className="practice-feedback-title">
                    {feedback.correct ? 'Correct.' : 'Incorrect.'}
                  </div>
                  <div className="practice-feedback-text">
                    <strong>Rationale / Expected:</strong> {feedback.text}
                  </div>
                </div>
              </div>
            )}
            {feedback && <AiHelper contextText={questionContext()} program={program.key} subject={subject} itemKey={current.id} />}
          </CardContent>
        </Card>
      )}

      {/* Sequence Mode */}
      {!loading && !empty && !done && current && mode === 'sequence' && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="md">{current.subject} · Priority &amp; Sequence Ordering</Badge>
            </div>

            <h3 className="practice-question-heading">{(current.question as SequenceQuestion).prompt}</h3>
            <p className="practice-instruction">Arrange the clinical, dispensing, or procedural steps in the correct priority order (top = first).</p>

            <div className="practice-sequence-list">
              {seqOrder.map((item, i) => (
                <div key={item + i} className="practice-sequence-item" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)', gap: 12
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 15 }}>{item}</span>
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="ghost" size="icon" onClick={() => !feedback && moveSeq(i, -1)} disabled={i === 0 || !!feedback} aria-label="Move up"><Icon name="chevron-up" size={16} aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => !feedback && moveSeq(i, 1)} disabled={i === seqOrder.length - 1 || !!feedback} aria-label="Move down"><Icon name="chevron-down" size={16} aria-hidden="true" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="practice-submit-actions">
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitSequence} fullWidth style={{ maxWidth: 240 }}>Check order</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 240 }}>Next question</Button>
              )}
            </div>

            {feedback && (
              <div className="practice-feedback" data-correct={feedback.correct}>
                <div className="practice-feedback-icon">
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} />
                </div>
                <div className="practice-feedback-copy">
                    <div className="practice-feedback-title">
                      {feedback.correct ? 'Correct order.' : 'Incorrect order.'}
                    </div>
                    <div className="practice-feedback-text">
                      <strong>Rationale:</strong> {feedback.text}
                    </div>
                    {!feedback.correct && (
                      <div className="practice-correct-answer">
                        <strong style={{ color: 'var(--success)' }}>Correct order:</strong> <span style={{ marginLeft: 8 }}>{(current.answer as SequenceAnswer).order.join(' → ')}</span>
                      </div>
                    )}
                </div>
              </div>
            )}
            {feedback && <AiHelper contextText={questionContext()} program={program.key} subject={subject} itemKey={current.id} />}
          </CardContent>
        </Card>
      )}

      {/* Identification Mode (course track) */}
      {!loading && !empty && !done && current && mode === 'identification' && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="md">{current.subject} · Identification</Badge>
            </div>

            {(current.question as DiagnosisQuestion).scenario && (
              <div className="practice-content-block">
                <div className="practice-field-label">Context</div>
                <div className="practice-context">
                  {(current.question as DiagnosisQuestion).scenario}
                </div>
              </div>
            )}

            <div className="practice-content-block">
              <div className="practice-field-label">Prompt</div>
              <div className="practice-prompt">
                {(current.question as DiagnosisQuestion).prompt}
              </div>
            </div>

            <div className="practice-content-block">
              <label htmlFor="identification-input" className="practice-field-label">Your Answer</label>
              <input
                id="identification-input"
                value={diagInput}
                onChange={e => setDiagInput(e.target.value)}
                placeholder="Type the term or concept you identify..."
                disabled={!!feedback}
                className="practice-answer-input"
                aria-describedby={feedback ? 'practice-feedback' : undefined}
              />
            </div>

            <div className="practice-submit-actions">
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitIdentification} disabled={!diagInput} fullWidth style={{ maxWidth: 240 }}>Check answer</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 240 }}>Next question</Button>
              )}
            </div>

            {feedback && (
              <div className="practice-feedback" data-correct={feedback.correct} id="practice-feedback">
                <div className="practice-feedback-icon">
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} />
                </div>
                <div className="practice-feedback-copy">
                    <div className="practice-feedback-title">
                      {feedback.correct ? 'Correct.' : 'Incorrect.'}
                    </div>
                    <div className="practice-feedback-text">
                      <strong>Rationale / Expected:</strong> {feedback.text}
                    </div>
                </div>
              </div>
            )}
            {feedback && <AiHelper contextText={questionContext()} program={program.key} subject={subject} itemKey={current.id} />}
          </CardContent>
        </Card>
      )}

      {/* Enumeration Mode (course track) */}
      {!loading && !empty && !done && current && mode === 'enumeration' && (
        <Card variant="elevated" className="practice-question-card">
          <CardContent className="practice-question-content">
            <div className="practice-question-meta">
              <Badge variant="primary" size="md">{current.subject} · Enumeration</Badge>
            </div>

            <div className="practice-content-block">
              <div className="practice-field-label">Prompt</div>
              <div className="practice-prompt">
                {(current.question as DiagnosisQuestion).prompt}
              </div>
            </div>

            <div className="practice-content-block">
              <label htmlFor="enumeration-input" className="practice-field-label">Your List</label>
              <textarea
                id="enumeration-input"
                value={diagInput}
                onChange={e => setDiagInput(e.target.value)}
                placeholder="List each item on a new line or separated by commas..."
                disabled={!!feedback}
                rows={6}
                className="practice-answer-input practice-answer-textarea"
                aria-describedby={feedback ? 'practice-feedback' : undefined}
              />
              <p className="practice-instruction">List every expected item; order doesn’t matter.</p>
            </div>

            <div className="practice-submit-actions">
              {!feedback && (
                <Button variant="primary" size="lg" onClick={submitEnumeration} disabled={!diagInput.trim()} fullWidth style={{ maxWidth: 240 }}>Check answers</Button>
              )}
              {feedback && (
                <Button variant="primary" size="lg" rightIcon="chevron-right" onClick={next} fullWidth style={{ maxWidth: 240 }}>Next question</Button>
              )}
            </div>

            {feedback && (
              <div className="practice-feedback" data-correct={feedback.correct} id="practice-feedback">
                <div className="practice-feedback-icon">
                  <Icon name={feedback.correct ? 'check-circle' : 'x-circle'} size={22} />
                </div>
                <div className="practice-feedback-copy">
                    <div className="practice-feedback-title">
                      {feedback.correct ? 'Correct — all items listed.' : 'Incorrect — check the expected list.'}
                    </div>
                    <div className="practice-feedback-text">
                      <strong>Rationale / Expected items:</strong> {feedback.text}
                    </div>
                </div>
              </div>
            )}
            {feedback && <AiHelper contextText={questionContext()} program={program.key} subject={subject} itemKey={current.id} />}
          </CardContent>
        </Card>
      )}

      {!loading && !empty && !done && !feedback && !reveal && (current || currentCard) && (
        <section className="practice-hint-panel" aria-label="Study hints">
          <div className="practice-hint-copy">
            <span className="practice-hint-icon" aria-hidden="true"><Icon name="brain" size={18} /></span>
            <div>
              <h3>Need a nudge?</h3>
              <p>Get a small clue without revealing the answer.</p>
            </div>
          </div>
          {hints.length > 0 && (
            <ol className="practice-hint-list" aria-live="polite">
              {hints.map((hint, index) => <li key={`${index}-${hint}`}>{hint}</li>)}
            </ol>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon="brain"
            onClick={requestHint}
            loading={hintLoading}
            disabled={hints.length >= 2}
          >
            {hintLoading ? 'Thinking…' : hints.length >= 2 ? 'No more hints' : hints.length ? 'Get another hint' : 'Get a hint'}
          </Button>
        </section>
      )}
      {levelUp != null && <LevelUpCelebration level={levelUp} onClose={() => setLevelUp(null)} />}
      </div>
      <aside className="practice-companion" aria-label="Study with Lilo">
        <LiloSpeechPanel key={speechContextKey} text={studySpeechText()} />
      </aside>
      </div>
      {modeTabs.filter(tab => tab.value !== mode).map(tab => (
        <div key={tab.value} role="tabpanel" id={`panel-${tab.value}`} aria-labelledby={`tab-${tab.value}`} hidden />
      ))}
    </div>
  )
}