import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { McqAnswer, McqQuestion, PracticeItem } from '@/types'
import type { GameWorldCollectible, GameWorldObstacle } from '@/components/GameWorld3D'
import { obstacleDodged, type GameObstacleKind, type PlayerAction } from '@/lib/gameMode'
import { gameSound } from '@/lib/gameSound'
import { readQuestionAloud, stopMascotVoice } from '@/lib/mascotVoice'
import { Badge, Button, Card, Icon, useToast } from '@/components/ui'

const GameWorld3D = lazy(() => import('@/components/GameWorld3D'))
type Obstacle = GameWorldObstacle
type GameStatus = 'ready' | 'running' | 'paused' | 'gameover'

const CHECKPOINT_DISTANCE = 200
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
  const [playerAction, setPlayerAction] = useState<PlayerAction>('run')
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [collectibles, setCollectibles] = useState<GameWorldCollectible[]>([])
  const [distance, setDistance] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null)
  const [soundOn, setSoundOn] = useState(gameSound.isEnabled)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [resultAnnounced, setResultAnnounced] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gameMessage, setGameMessage] = useState('')
  const timerRef = useRef<number | null>(null)
  const actionTimerRef = useRef<number | null>(null)
  const obstacleSpawnTimer = useRef(0)
  const obstacleId = useRef(0)
  const collectibleId = useRef(0)
  const obstaclesRef = useRef<Obstacle[]>([])
  const collectiblesRef = useRef<GameWorldCollectible[]>([])
  const distanceRef = useRef(0)
  const livesRef = useRef(3)
  const timeLeftRef = useRef(QUESTION_SECONDS)
  const countdownRef = useRef<number | null>(null)
  const wasCorrectRef = useRef(false)
  const [gameEvent, setGameEvent] = useState<'none' | 'hit' | 'dodge' | 'collect' | 'gold'>('none')
  const [screenFlash, setScreenFlash] = useState<'none' | 'hit' | 'dodge'>('none')
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: number; text: string; x: number; y: number; color: string; life: number }>>([])
  const [combo, setCombo] = useState(0)
  const floatingIdRef = useRef(0)
  const { addToast } = useToast()

  useEffect(() => {
    if (!profile) return
    async function load() {
      // Only show the preparation card on the very first load. When the profile
      // is refreshed mid-run (resumeAfterCheckpoint), a full "Preparing…"
      // overlay would flash over the game while obstacles keep moving, making
      // the player lose through no fault of their own.
      const firstLoad = items.length === 0
      if (firstLoad) setLoading(true)
      let subjectQuery = supabase.from('practice_items').select('subject').eq('user_id', profile!.id).eq('type', 'mcq')
      if (materialId) subjectQuery = subjectQuery.eq('material_id', materialId)
      const { data: subjectData } = await subjectQuery
      const names = [...new Set((subjectData as Array<{ subject: string }> | null)?.map(row => row.subject) || [])]
      setSubjects(names)

      const chosenSubject = subject || names[0] || ''
      setSubject(chosenSubject)
      if (!chosenSubject) {
        setItems([])
        if (firstLoad) setLoading(false)
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
      if (firstLoad) setLoading(false)
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

  const performAction = useCallback((action: Exclude<PlayerAction, 'run'>) => {
    if (status !== 'running') return
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current)
    setPlayerAction(action)
    if (action === 'jump') gameSound.playJump()
    else if (action === 'slide') gameSound.playSlide()
    actionTimerRef.current = window.setTimeout(() => {
      setPlayerAction('run')
      actionTimerRef.current = null
    }, 680)
  }, [status])

  const toggleSound = () => {
    setSoundOn(gameSound.toggle())
  }

  const stopSpeech = useCallback(() => {
    stopMascotVoice()
    setIsSpeaking(false)
    setVoiceLoading(false)
  }, [])

  const speakMessage = useCallback((message: string) => {
    const cleanMessage = message.trim()
    if (!cleanMessage) return
    const playback = readQuestionAloud(
      cleanMessage,
      'en-US-TonyNeural',
      () => setIsSpeaking(false),
      setVoiceLoading,
      () => setIsSpeaking(true),
    )
    void playback.catch(error => {
      setIsSpeaking(false)
      setVoiceLoading(false)
      addToast({
        type: 'error',
        title: 'Lilo could not speak',
        message: error instanceof Error ? error.message : 'Speech playback failed.',
      })
    })
  }, [addToast])

  const gameQuestionText = useCallback(() => {
    if (!mcqQuestion) return ''
    const options = mcqQuestion.options
      .map((option, index) => `Option ${String.fromCharCode(65 + index)}: ${option}`)
      .join('. ')
    return `Question. ${mcqQuestion.stem}. ${options}.`
  }, [mcqQuestion])

  const addFloatingText = useCallback((text: string, color: string) => {
    const id = ++floatingIdRef.current
    setFloatingTexts(previous => [...previous, { id, text, x: 50, y: 42, color, life: 1 }])
  }, [])

  const handleSwipe = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (direction === 'left') moveLane(lane - 1)
    else if (direction === 'right') moveLane(lane + 1)
    else performAction(direction === 'up' ? 'jump' : 'slide')
  }, [lane, moveLane, performAction])

  useEffect(() => () => {
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current)
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (countdownRef.current) window.clearInterval(countdownRef.current)
    stopSpeech()
  }, [])

  // One-shot game event: tell GameWorld3D to shake / react, then reset.
  useEffect(() => {
    if (gameEvent === 'none') return
    const frame = requestAnimationFrame(() => setGameEvent('none'))
    return () => cancelAnimationFrame(frame)
  }, [gameEvent])

  // Screen flash auto-reset after a hit or dodge.
  useEffect(() => {
    if (screenFlash === 'none') return
    const timer = setTimeout(() => setScreenFlash('none'), 140)
    return () => clearTimeout(timer)
  }, [screenFlash])

  // Animate floating score texts upward and fade them out.
  useEffect(() => {
    const interval = setInterval(() => {
      setFloatingTexts(previous => {
        const next = previous.map(ft => ({ ...ft, life: ft.life - 0.05, y: ft.y - 0.9 }))
        return next.filter(ft => ft.life > 0)
      })
    }, 40)
    return () => clearInterval(interval)
  }, [])

  const startGame = async () => {
    await gameSound.boot()
    gameSound.playStart()
    stopSpeech()
    setCountdown(null)
    setStatus('running')
    setLane(1)
    obstaclesRef.current = []
    collectiblesRef.current = []
    setObstacles([])
    setCollectibles([])
    distanceRef.current = 0
    setDistance(0)
    setTotalDistance(0)
    setScore(0)
    livesRef.current = 3
    setLives(3)
    setQuestionIndex(0)
    setCombo(0)
    setGameMessage('')
    setPlayerAction('run')
    obstacleSpawnTimer.current = 0
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current)
  }

  useEffect(() => {
    if (status !== 'running') return
    const interval = window.setInterval(() => {
      obstacleSpawnTimer.current += 0.1
      const spawnRow = obstacleSpawnTimer.current >= 1.15
      if (spawnRow) obstacleSpawnTimer.current = 0
      const availableLanes = [0, 1, 2].sort(() => Math.random() - 0.5)
      const obstacleCount = Math.random() < 0.58 ? 2 : 1
      const newObstacles: Obstacle[] = spawnRow
        ? availableLanes.slice(0, obstacleCount).map(laneIndex => ({
          id: ++obstacleId.current,
          lane: laneIndex,
          progress: -8,
          kind: (['low', 'overhead', 'tall'] as const)[Math.floor(Math.random() * 3)],
        }))
        : []
      const newCollectibles: GameWorldCollectible[] = spawnRow
        ? Array.from({ length: 2 + Math.floor(Math.random() * 2) }, (_, index) => ({
          id: ++collectibleId.current,
          lane: availableLanes[obstacleCount],
          progress: -8 - index * 7,
          kind: Math.random() < 0.18 ? 'gold' as const : 'capsule' as const,
        }))
        : []

      const nextDistance = distanceRef.current + 1
      distanceRef.current = nextDistance
      setDistance(nextDistance)
      if (nextDistance >= CHECKPOINT_DISTANCE && nextDistance - 1 < CHECKPOINT_DISTANCE) {
        setStatus('paused')
        timeLeftRef.current = QUESTION_SECONDS
        setTimeLeft(QUESTION_SECONDS)
        setSelectedAnswer(null)
        setAnswerResult(null)
      }
      setTotalDistance(previous => previous + 1)
      setScore(previous => previous + 1)

      let nextObstacles = [
        ...obstaclesRef.current.map(obstacle => ({ ...obstacle, progress: obstacle.progress + 5 }))
          .filter(obstacle => obstacle.progress < 100),
        ...newObstacles,
      ]
      const collision = nextObstacles.find(obstacle =>
        obstacle.lane === lane && obstacle.progress > 76 && obstacle.progress < 91,
      )
      if (collision) {
        if (obstacleDodged(collision.kind, playerAction)) {
          gameSound.playDodge()
          setGameEvent('dodge')
          setScreenFlash('dodge')
          setCombo(previous => previous + 1)
          addFloatingText('+25', '#4ade80')
          setScore(previousScore => previousScore + 25)
          setGameMessage('Great move! +25 points')
        } else {
          gameSound.playHit()
          setGameEvent('hit')
          setScreenFlash('hit')
          setCombo(0)
          const nextLives = Math.max(0, livesRef.current - 1)
          livesRef.current = nextLives
          setLives(nextLives)
          setGameMessage('Ouch! Lilo hit an obstacle.')
          if (nextLives === 0) {
            gameSound.playGameOver()
            setStatus('gameover')
          }
        }
        nextObstacles = nextObstacles.filter(obstacle => obstacle.id !== collision.id)
      }
      obstaclesRef.current = nextObstacles
      setObstacles(nextObstacles)

      let nextCollectibles = [
        ...collectiblesRef.current.map(item => ({ ...item, progress: item.progress + 5 }))
          .filter(item => item.progress < 100),
        ...newCollectibles,
      ]
      const collected = nextCollectibles.filter(item =>
        item.lane === lane && item.progress > 76 && item.progress < 91,
      )
      if (collected.length) {
        const hasGold = collected.some(item => item.kind === 'gold')
        const points = collected.reduce((sum, item) => sum + (item.kind === 'gold' ? 100 : 20), 0)
        if (hasGold) {
          gameSound.playCollectGold()
          setGameEvent('gold')
          addFloatingText('+100', '#fbbf24')
        } else {
          gameSound.playCollectCapsule()
          setGameEvent('collect')
          addFloatingText('+20', '#22d3ee')
        }
        setCombo(previous => previous + 1)
        setScore(previousScore => previousScore + points)
        setGameMessage(collected.some(item => item.kind === 'gold') ? 'Golden Rx collected!' : 'Capsules collected!')
        nextCollectibles = nextCollectibles.filter(item => !collected.some(pickup => pickup.id === item.id))
      }
      collectiblesRef.current = nextCollectibles
      setCollectibles(nextCollectibles)
    }, 100)
    return () => window.clearInterval(interval)
  }, [status, lane, playerAction])

  useEffect(() => {
    if (status !== 'paused' || answerResult) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      const nextTime = Math.max(0, timeLeftRef.current - 1)
      timeLeftRef.current = nextTime
      setTimeLeft(nextTime)
      if (nextTime === 0) {
        window.clearInterval(timerRef.current!)
        timerRef.current = null
        setAnswerResult('wrong')
        gameSound.playCheckpointWrong()
        const nextLives = Math.max(0, livesRef.current - 1)
        livesRef.current = nextLives
        setLives(nextLives)
        if (nextLives === 0) {
          gameSound.playGameOver()
          setStatus('gameover')
        }
      }
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [status, answerResult, questionIndex])

  // Lilo reads the checkpoint question aloud when it appears.
  useEffect(() => {
    if (status !== 'paused' || answerResult !== null || !mcqQuestion) return
    const timer = window.setTimeout(() => {
      speakMessage(gameQuestionText())
    }, 500)
    return () => window.clearTimeout(timer)
  }, [status, answerResult, mcqQuestion, gameQuestionText, speakMessage])

  // Lilo reads the answer result after the user submits.
  useEffect(() => {
    if (answerResult === null || !mcqQuestion || !mcqAnswer) {
      setResultAnnounced(false)
      return
    }
    setResultAnnounced(false)
    const timer = window.setTimeout(() => {
      setResultAnnounced(true)
      const correct = answerResult === 'correct'
      const option = mcqQuestion.options[mcqAnswer.correctIndex]
      speakMessage(
        correct
          ? `Correct! The answer is ${String.fromCharCode(65 + mcqAnswer.correctIndex)}: ${option}.`
          : `Not quite. The correct answer is ${String.fromCharCode(65 + mcqAnswer.correctIndex)}: ${option}.`,
      )
    }, 700)
    return () => window.clearTimeout(timer)
  }, [answerResult, mcqQuestion, mcqAnswer, speakMessage])

  const resumeAfterCheckpoint = useCallback(async (correct: boolean) => {
    stopSpeech()
    let leaderboardPoints = 0
    if (currentQuestion && user) {
      try {
        const { data, error } = await supabase.rpc('record_game_mcq_attempt', {
          p_practice_item_id: currentQuestion.id,
          p_selected: selectedAnswer,
        })
        if (error) throw new Error(error.message)
        const result = Array.isArray(data) ? data[0] : data
        if (!result) throw new Error('Game answer recording returned no result.')
        leaderboardPoints = Number(result.points_awarded) || 0
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Could not save leaderboard points',
          message: error instanceof Error ? error.message : 'The game answer could not be recorded.',
        })
      }
    }
    if (correct) setScore(previous => previous + 100)
    setQuestionIndex(previous => previous + 1)
    const remainingDistance = Math.max(0, distanceRef.current - CHECKPOINT_DISTANCE)
    distanceRef.current = remainingDistance
    setDistance(remainingDistance)
    setSelectedAnswer(null)
    setAnswerResult(null)
    timeLeftRef.current = QUESTION_SECONDS
    setTimeLeft(QUESTION_SECONDS)
    setGameMessage(correct
      ? `Checkpoint cleared! +100 points${leaderboardPoints ? ` · +${leaderboardPoints} leaderboard points` : ''}`
      : 'Keep going—you will get the next one.')
    setStatus(livesRef.current > 0 ? 'running' : 'gameover')
    if (profile) await refreshProfile()
  }, [addToast, currentQuestion, profile, refreshProfile, selectedAnswer, user])

  // Auto-start the resume countdown only after Lilo has finished speaking
  // the answer result. The countdown must not cut Lilo off mid-sentence.
  useEffect(() => {
    if (answerResult === null) return
    if (livesRef.current === 0) return
    if (!resultAnnounced) return // Lilo hasn't started speaking the result yet
    if (isSpeaking || voiceLoading) return // Wait for generation and playback to finish.
    wasCorrectRef.current = answerResult === 'correct'
    setCountdown(3)
  }, [answerResult, resultAnnounced, isSpeaking, voiceLoading, livesRef.current])

  // Countdown 3 → 2 → 1 → Go, then resume the run.
  useEffect(() => {
    if (countdown == null) return
    if (countdown <= 0) {
      window.clearInterval(countdownRef.current!)
      countdownRef.current = null
      setCountdown(null)
      resumeAfterCheckpoint(wasCorrectRef.current)
      return
    }
    countdownRef.current = window.setInterval(() => {
      setCountdown(previous => {
        if (previous == null || previous <= 1) {
          window.clearInterval(countdownRef.current!)
          countdownRef.current = null
          setCountdown(null)
          resumeAfterCheckpoint(wasCorrectRef.current)
          return null
        }
        return previous - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current)
    }
  }, [countdown, resumeAfterCheckpoint])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (status !== 'running') return
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault()
        moveLane(lane - 1)
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault()
        moveLane(lane + 1)
      }
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' || event.code === 'Space') {
        event.preventDefault()
        performAction('jump')
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        event.preventDefault()
        performAction('slide')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, lane, moveLane, performAction])

  const submitAnswer = (index: number) => {
    if (answerResult !== null || mcqAnswer == null) return
    setSelectedAnswer(index)
    const correct = index === mcqAnswer.correctIndex
    setAnswerResult(correct ? 'correct' : 'wrong')
    if (correct) {
      gameSound.playCheckpointCorrect()
      addFloatingText('+100', '#4ade80')
      setCombo(previous => previous + 1)
    } else {
      gameSound.playCheckpointWrong()
      setCombo(0)
    }
    if (!correct) {
      const nextLives = Math.max(0, livesRef.current - 1)
      livesRef.current = nextLives
      setLives(nextLives)
      if (nextLives === 0) {
        gameSound.playGameOver()
        setStatus('gameover')
      }
    }
  }

  const changeSubject = (nextSubject: string) => {
    setSubject(nextSubject)
    setSearchParams(nextSubject ? { subject: nextSubject, ...(materialId ? { material: materialId } : {}) } : {})
  }

  return (
    <div className="game-page">
      {loading ? (
        <Card padding="lg" className="game-preparation">
          <div className="game-empty">Preparing Lilo's questions…</div>
        </Card>
      ) : items.length === 0 ? (
        <Card padding="lg" className="game-empty-card">
          <Icon name="flag" size={30} />
          <h2>No MCQ checkpoints yet</h2>
          <p>Add a reviewer or upload course material, then generate practice questions to unlock Game Mode.</p>
          <Button onClick={() => navigate('/reviewer')} leftIcon="upload">Add study material</Button>
        </Card>
      ) : (
        <div className="game-screen">
          {screenFlash !== 'none' && (
            <div className={`screen-flash screen-flash-${screenFlash}`} aria-hidden="true" />
          )}
          {floatingTexts.map(ft => (
            <div
              key={ft.id}
              className="floating-text"
              style={{
                left: `${ft.x}%`,
                top: `${ft.y}%`,
                color: ft.color,
                opacity: ft.life,
                transform: `translate(-50%, -50%) scale(${1 + (1 - ft.life) * 0.4})`,
              }}
            >
              {ft.text}
            </div>
          ))}
          {combo > 1 && <div className="combo-badge">Combo x{combo}</div>}
          <div className="game-header">
            <div className="game-title">
              <span className="section-kicker"><span className="eyebrow-dot" /> LILO GAME MODE</span>
              <h1>Rx Runner</h1>
            </div>
            {subjects.length > 1 && (
              <label className="game-subject-picker">
                Subject
                <select value={subject} onChange={event => changeSubject(event.target.value)}>
                  {subjects.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            )}
            <button
              type="button"
              className="game-sound-toggle"
              aria-label="Toggle game sound"
              aria-pressed={soundOn}
              onClick={toggleSound}
            >
              <Icon name={soundOn ? 'volume-2' : 'x'} size={17} />
            </button>
            <Button variant="ghost" leftIcon="arrow-left" onClick={() => navigate('/dashboard')}>Exit game</Button>
          </div>

          <div className="game-layout">
            <Card padding="none" className="runner-card">
              <div className="runner-hud">
                <Badge variant="primary"><Icon name="trophy" size={13} /> {score} pts</Badge>
                <Badge variant="info"><Icon name="target" size={13} /> {Math.floor(distance)} / {CHECKPOINT_DISTANCE} m</Badge>
                <div className="lives" aria-label={`${lives} lives left`}>
                  {[0, 1, 2].map(index => <span key={index} className={index < lives ? 'alive' : ''}>♥</span>)}
                </div>
              </div>

              <div className={`runner-track world-${worldIndex}`} aria-label={`${world.name} runner world`}>
                <Suspense fallback={<div className="game-scene-loading">Preparing the runner…</div>}>
                  <GameWorld3D
                    running={status === 'running'}
                    checkpoint={status === 'paused'}
                    lane={lane}
                    action={playerAction}
                    obstacles={obstacles}
                    collectibles={collectibles}
                    worldIndex={worldIndex}
                    onSwipe={handleSwipe}
                    event={gameEvent}
                  />
                </Suspense>
                {status === 'ready' && (
                  <div className="runner-overlay">
                    <h2>Ready to run?</h2>
                    <p>Change lanes, jump over bins, and slide under IV racks.</p>
                    <Button size="lg" onClick={startGame} leftIcon="zap">Start run</Button>
                  </div>
                )}
                {status === 'gameover' && (
                  <div className="runner-overlay">
                    <h2>Run complete</h2>
                    <p>You scored {score} points.</p>
                    <Button size="lg" onClick={startGame} leftIcon="refresh-cw">Run again</Button>
                  </div>
                )}
                {status === 'running' && gameMessage && <div className="runner-message">{gameMessage}</div>}
                {countdown != null && (
                  <div className="game-countdown">
                    <span className="countdown-number">{countdown > 0 ? countdown : 'Go!'}</span>
                  </div>
                )}

                {status === 'paused' && mcqQuestion && mcqAnswer && (
                  <div className="checkpoint-overlay">
                    <Card
                      padding="lg"
                      className="checkpoint-card"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="checkpoint-question"
                      aria-live="polite"
                    >
                      <div className="checkpoint-heading">
                        <Badge variant="warning"><Icon name="flag" size={13} /> Checkpoint</Badge>
                        <div className={`question-timer ${timeLeft <= 5 ? 'urgent' : ''}`}>
                          <Icon name="timer" size={16} /> {timeLeft}s
                        </div>
                        <button
                          type="button"
                          className="game-sound-toggle"
                          aria-label={isSpeaking ? 'Stop Lilo speaking' : 'Listen with Lilo'}
                          aria-pressed={isSpeaking}
                          disabled={!mcqQuestion || isSpeaking || voiceLoading}
                          onClick={() => {
                            if (isSpeaking) stopSpeech()
                            else speakMessage(gameQuestionText())
                          }}
                        >
                          <Icon name={isSpeaking ? 'x' : 'volume-2'} size={16} />
                        </button>
                      </div>
                      {voiceLoading && <p className="mascot-voice-loading" role="status">Preparing Lilo’s voice…</p>}
                      <h2 id="checkpoint-question">{mcqQuestion.stem}</h2>
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
                          {countdown != null ? (
                            <div className="checkpoint-countdown">
                              <span className="countdown-number">{countdown}</span>
                              <span className="countdown-label">Resuming run…</span>
                            </div>
                          ) : (
                            <Button
                              onClick={() => {
                                wasCorrectRef.current = answerResult === 'correct'
                                setCountdown(3)
                              }}
                              rightIcon="arrow-right"
                              disabled={lives <= 0 && answerResult === 'wrong'}
                            >
                              Continue run
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </div>

              {status === 'running' && (
                <div className="runner-controls" aria-label="Runner controls">
                  <button type="button" onClick={() => moveLane(lane - 1)} aria-label="Move left">
                    <Icon name="arrow-left" size={18} /><span>Lane</span>
                  </button>
                  <button type="button" onClick={() => performAction('jump')} aria-label="Jump">
                    <Icon name="zap" size={18} /><span>Jump</span>
                  </button>
                  <button type="button" onClick={() => performAction('slide')} aria-label="Slide">
                    <Icon name="arrow-down" size={18} /><span>Slide</span>
                  </button>
                  <button type="button" onClick={() => moveLane(lane + 1)} aria-label="Move right">
                    <Icon name="arrow-right" size={18} /><span>Lane</span>
                  </button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
