import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { McqAnswer, McqQuestion, PracticeItem } from '@/types'
import { Badge, Button, Card, Icon } from '@/components/ui'
import liloAvatar from '@/assets/mascot/mascot-avatar-256.png'

type Obstacle = { id: number; lane: number; progress: number; kind: 'barrier' | 'crate' | 'cart' }
type GameStatus = 'ready' | 'running' | 'paused' | 'gameover'

const CHECKPOINT_DISTANCE = 180
const QUESTION_SECONDS = 20
const WORLDS = [
  { name: 'Pharmora Central', sign: 'CITY LINE' },
  { name: 'Riverside Station', sign: 'RIVER ROUTE' },
  { name: 'Garden District', sign: 'GREEN LINE' },
]

export default function GameModePage() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<PracticeItem[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState(searchParams.get('subject') || '')
  const [materialId, setMaterialId] = useState(searchParams.get('material') || '')
  const [status, setStatus] = useState<GameStatus>('ready')
  const [lane, setLane] = useState(1)
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [distance, setDistance] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null)
  const [loading, setLoading] = useState(true)
  const [gameMessage, setGameMessage] = useState('')
  const timerRef = useRef<number | null>(null)
  const obstacleId = useRef(0)

  useEffect(() => {
    if (!profile) return
    async function load() {
      setLoading(true)
      let subjectQuery = supabase.from('practice_items').select('subject').eq('user_id', profile!.id).eq('type', 'mcq')
      if (materialId) subjectQuery = subjectQuery.eq('material_id', materialId)
      const { data: subjectData } = await subjectQuery
      const names = [...new Set((subjectData as Array<{ subject: string }> | null)?.map(row => row.subject) || [])]
      setSubjects(names)

      const chosenSubject = subject || names[0] || ''
      setSubject(chosenSubject)
      if (!chosenSubject) {
        setItems([])
        setLoading(false)
        return
      }

      let itemQuery = supabase
        .from('practice_items')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('subject', chosenSubject)
        .eq('type', 'mcq')
      if (materialId) itemQuery = itemQuery.eq('material_id', materialId)
      const { data, error } = await itemQuery.limit(30)
      if (!error) setItems((data as PracticeItem[]) || [])
      setLoading(false)
    }
    load()
  }, [profile, materialId, subject])

  const currentQuestion = items[questionIndex % Math.max(items.length, 1)] || null
  const mcqQuestion = currentQuestion?.question as McqQuestion | undefined
  const mcqAnswer = currentQuestion?.answer as McqAnswer | undefined
  const worldIndex = Math.floor(totalDistance / (CHECKPOINT_DISTANCE * 4)) % WORLDS.length
  const world = WORLDS[worldIndex]

  const moveLane = useCallback((nextLane: number) => {
    setLane(Math.max(0, Math.min(2, nextLane)))
  }, [])

  const startGame = () => {
    setStatus('running')
    setLane(1)
    setObstacles([])
    setDistance(0)
    setTotalDistance(0)
    setScore(0)
    setLives(3)
    setQuestionIndex(0)
    setGameMessage('')
  }

  useEffect(() => {
    if (status !== 'running') return
    const interval = window.setInterval(() => {
      setDistance(previous => {
        const next = previous + 4
        if (next >= CHECKPOINT_DISTANCE && previous < CHECKPOINT_DISTANCE) {
          setStatus('paused')
          setTimeLeft(QUESTION_SECONDS)
          setSelectedAnswer(null)
          setAnswerResult(null)
        }
        return next
      })
      setTotalDistance(previous => previous + 4)

      setObstacles(previous => {
        let nextObstacles = previous
          .map(obstacle => ({ ...obstacle, progress: obstacle.progress + 5 }))
          .filter(obstacle => obstacle.progress < 100)

        if (Math.random() > 0.78) {
          nextObstacles = [
            ...nextObstacles,
            {
              id: ++obstacleId.current,
              lane: Math.floor(Math.random() * 3),
              progress: -8,
              kind: (['barrier', 'crate', 'cart'] as const)[Math.floor(Math.random() * 3)],
            }
          ]
        }

        const collision = nextObstacles.find(obstacle =>
          obstacle.lane === lane && obstacle.progress > 76 && obstacle.progress < 91,
        )
        if (collision) {
          setLives(previousLives => {
            const nextLives = previousLives - 1
            setGameMessage('Ouch! Lilo hit an obstacle.')
            if (nextLives <= 0) setStatus('gameover')
            return Math.max(0, nextLives)
          })
          nextObstacles = nextObstacles.filter(obstacle => obstacle.id !== collision.id)
        }
        return nextObstacles
      })
    }, 100)
    return () => window.clearInterval(interval)
  }, [status, lane])

  useEffect(() => {
    if (status !== 'paused' || answerResult) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setTimeLeft(previous => {
        if (previous <= 1) {
          window.clearInterval(timerRef.current!)
          timerRef.current = null
          setAnswerResult('wrong')
          setLives(current => {
            const next = current - 1
            if (next <= 0) setStatus('gameover')
            return Math.max(0, next)
          })
          return 0
        }
        return previous - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [status, answerResult, questionIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (status !== 'running') return
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') moveLane(lane - 1)
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') moveLane(lane + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, lane, moveLane])

  const resumeAfterCheckpoint = useCallback(async (correct: boolean) => {
    if (currentQuestion && user) {
      await supabase.from('attempts').insert({
        user_id: user.id,
        practice_item_id: currentQuestion.id,
        board_program: profile?.board_program || 'pharmacy',
        subject: currentQuestion.subject,
        type: 'mcq',
        user_response: { selected: selectedAnswer },
        is_correct: correct,
      })
    }
    if (correct) setScore(previous => previous + 100)
    setQuestionIndex(previous => previous + 1)
    setDistance(previous => previous - CHECKPOINT_DISTANCE)
    setSelectedAnswer(null)
    setAnswerResult(null)
    setTimeLeft(QUESTION_SECONDS)
    setGameMessage(correct ? 'Checkpoint cleared! +100 points' : 'Keep going—you will get the next one.')
    setStatus(lives > 0 ? 'running' : 'gameover')
    if (profile) await refreshProfile()
  }, [currentQuestion, lives, profile, refreshProfile, selectedAnswer, user])

  const submitAnswer = (index: number) => {
    if (answerResult !== null || mcqAnswer == null) return
    setSelectedAnswer(index)
    const correct = index === mcqAnswer.correctIndex
    setAnswerResult(correct ? 'correct' : 'wrong')
    if (!correct) setLives(previous => Math.max(0, previous - 1))
  }

  const changeSubject = (nextSubject: string) => {
    setSubject(nextSubject)
    setSearchParams(nextSubject ? { subject: nextSubject, ...(materialId ? { material: materialId } : {}) } : {})
  }

  const laneButtons = useMemo(() => [0, 1, 2], [])

  return (
    <div className="game-page">
      <div className="game-header">
        <div>
          <span className="section-kicker"><span className="eyebrow-dot" /> LILO GAME MODE</span>
          <h1>Checkpoint Run</h1>
          <p>Dodge obstacles, reach checkpoints, and answer questions before time runs out.</p>
        </div>
        {subjects.length > 1 && (
          <label className="game-subject-picker">
            Subject
            <select value={subject} onChange={event => changeSubject(event.target.value)}>
              {subjects.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <Card padding="lg"><div className="game-empty">Preparing Lilo's questions…</div></Card>
      ) : items.length === 0 ? (
        <Card padding="lg" className="game-empty-card">
          <Icon name="flag" size={30} />
          <h2>No MCQ checkpoints yet</h2>
          <p>Add a reviewer or upload course material, then generate practice questions to unlock Game Mode.</p>
          <Button onClick={() => navigate('/reviewer')} leftIcon="upload">Add study material</Button>
        </Card>
      ) : (
        <div className="game-layout">
          <Card padding="none" className="runner-card">
            <div className="runner-hud">
              <Badge variant="primary"><Icon name="trophy" size={13} /> {score} pts</Badge>
              <Badge variant="info"><Icon name="target" size={13} /> {Math.floor(distance)} / {CHECKPOINT_DISTANCE} m</Badge>
              <div className="lives" aria-label={`${lives} lives left`}>
                {[0, 1, 2].map(index => <span key={index} className={index < lives ? 'alive' : ''}>♥</span>)}
              </div>
            </div>

            <div className={`runner-track world-${worldIndex}${status === 'running' ? ' runner-track--running' : ''}`} aria-label={`${world.name} subway track`}>
              <div className="world-skyline" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <span key={index} className={`skyline-building building-${index % 4}`} />
                ))}
              </div>
              <div className="world-tree tree-left tree-0" aria-hidden="true"><i /><span /></div>
              <div className="world-tree tree-left tree-1" aria-hidden="true"><i /><span /></div>
              <div className="world-tree tree-right tree-0" aria-hidden="true"><i /><span /></div>
              <div className="world-tree tree-right tree-1" aria-hidden="true"><i /><span /></div>
              <div className="world-station-sign" aria-hidden="true">
                <small>PHARMORA METRO</small>
                <strong>{world.name}</strong>
                <span>{world.sign}</span>
              </div>
              <div className="runner-road">
                {[0, 1, 2].map(index => <span key={index} className={`road-lane lane-${index}`} />)}
                {obstacles.map(obstacle => (
                  <div
                    key={obstacle.id}
                    className={`runner-obstacle obstacle-${obstacle.kind}`}
                    style={{
                      left: `${16.666 + obstacle.lane * 33.333}%`,
                      top: `${obstacle.progress}%`,
                      transform: `translateX(-50%) scale(${Math.max(0.45, Math.min(1.25, 0.55 + obstacle.progress / 160))})`,
                    }}
                    aria-hidden="true"
                  >
                    <span />
                  </div>
                ))}
              </div>
              {status === 'ready' && (
                <div className="runner-overlay">
                  <img src={liloAvatar} alt="Lilo mascot" />
                  <h2>Ready to run?</h2>
                  <p>Use ← → or A D to dodge.</p>
                  <Button size="lg" onClick={startGame} leftIcon="zap">Start run</Button>
                </div>
              )}
              {status === 'gameover' && (
                <div className="runner-overlay">
                  <img src={liloAvatar} alt="Lilo mascot" />
                  <h2>Run complete</h2>
                  <p>You scored {score} points.</p>
                  <Button size="lg" onClick={startGame} leftIcon="refresh-cw">Run again</Button>
                </div>
              )}
              {status === 'running' && gameMessage && <div className="runner-message">{gameMessage}</div>}
              {status !== 'ready' && status !== 'gameover' && (
                <img
                  className="lilo-runner"
                  src={liloAvatar}
                  alt="Lilo"
                  style={{ left: `${16.666 + lane * 33.333}%` }}
                />
              )}
            </div>

            {status === 'running' && (
              <div className="runner-controls" aria-label="Runner controls">
                {laneButtons.map(index => (
                  <button
                    key={index}
                    type="button"
                    className={lane === index ? 'active' : ''}
                    onClick={() => moveLane(index)}
                    aria-label={`Move to lane ${index + 1}`}
                  >
                    {index === 0 ? '←' : index === 1 ? '•' : '→'}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {status === 'paused' && mcqQuestion && mcqAnswer && (
            <Card padding="lg" className="checkpoint-card" aria-live="polite">
              <div className="checkpoint-heading">
                <Badge variant="warning"><Icon name="flag" size={13} /> Checkpoint</Badge>
                <div className={`question-timer ${timeLeft <= 5 ? 'urgent' : ''}`}>
                  <Icon name="timer" size={16} /> {timeLeft}s
                </div>
              </div>
              <h2>{mcqQuestion.stem}</h2>
              <div className="checkpoint-options">
                {mcqQuestion.options.map((option, index) => {
                  const selected = selectedAnswer === index
                  const correct = mcqAnswer.correctIndex === index
                  const state = answerResult && (correct ? 'correct' : selected ? 'wrong' : '')
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`checkpoint-option ${state}`}
                      onClick={() => submitAnswer(index)}
                      disabled={answerResult !== null}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {option}
                    </button>
                  )
                })}
              </div>
              {answerResult && (
                <div className="checkpoint-result">
                  <p className={answerResult === 'correct' ? 'correct' : 'wrong'}>
                    {answerResult === 'correct' ? 'Correct! Lilo is back in motion.' : 'Not quite—Lilo lost a heart.'}
                  </p>
                  {currentQuestion.rationale && <small>{currentQuestion.rationale}</small>}
                  <Button
                    onClick={() => resumeAfterCheckpoint(answerResult === 'correct')}
                    rightIcon="arrow-right"
                    disabled={lives <= 0 && answerResult === 'wrong'}
                  >
                    Continue run
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
