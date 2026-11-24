import { useCallback, useEffect, useRef, useState } from 'react'
import { TtsMascot } from '@/components/ui/TtsMascot'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import useReducedMotion from '@/hooks/useReducedMotion'
import { readQuestionAloud, stopMascotVoice } from '@/lib/mascotVoice'

const LILO_MOTION_STORAGE_KEY = 'lilo-animations-enabled'

interface LiloSpeechPanelProps {
  text: string
  reaction?: 'laughing'
  answerCorrect?: boolean
  answerText?: string
  answerExplanation?: string
  muted: boolean
  onMutedChange: (muted: boolean) => void
  readyPromptOpen: boolean
  announceReadyPrompt: boolean
  onReadyPromptAnnounced: () => void
  onReadyPromptResponse: () => void
}

export default function LiloSpeechPanel({
  text,
  reaction,
  answerCorrect,
  answerText,
  answerExplanation,
  muted,
  onMutedChange,
  readyPromptOpen,
  announceReadyPrompt,
  onReadyPromptAnnounced,
  onReadyPromptResponse,
}: LiloSpeechPanelProps) {
  const { addToast } = useToast()
  const prefersReducedMotion = useReducedMotion()
  const [motionOverride, setMotionOverride] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(LILO_MOTION_STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return null
  })
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const readyPromptSpoken = useRef(false)
  const mutedRef = useRef(muted)
  const motionEnabled = motionOverride ?? !prefersReducedMotion
  mutedRef.current = muted

  useEffect(() => () => {
    stopMascotVoice()
  }, [])

  function stopSpeaking() {
    stopMascotVoice()
    setIsSpeaking(false)
    setVoiceLoading(false)
  }

  function toggleMotion() {
    const enabled = !motionEnabled
    try {
      window.localStorage.setItem(LILO_MOTION_STORAGE_KEY, String(enabled))
    } catch {
      addToast({
        type: 'error',
        title: 'Could not save Lilo’s animation setting',
        message: 'Your browser blocked local storage; this change will last only for this visit.',
      })
    }
    setMotionOverride(enabled)
  }

  const speakMessage = useCallback((message: string) => {
    const cleanMessage = message.trim()
    if (!cleanMessage || mutedRef.current) return
    setSpokenText(cleanMessage)
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

  useEffect(() => {
    if (!announceReadyPrompt || readyPromptSpoken.current) return
    readyPromptSpoken.current = true
    onReadyPromptAnnounced()
    speakMessage('Are you ready?')
  }, [announceReadyPrompt, onReadyPromptAnnounced, speakMessage])

  useEffect(() => {
    if (answerCorrect === undefined) return
    const correctAnswer = answerText?.trim()
    const explanation = answerExplanation?.trim()
    const answerMessage = answerCorrect
      ? correctAnswer ? `Correct! The answer is ${correctAnswer}.` : 'Correct!'
      : correctAnswer ? `Ha ha! Let's try again. The correct answer is ${correctAnswer}.` : "Ha ha! Let's try again."
    const message = `${answerMessage} ${explanation ? `Here's why: ${explanation}` : 'No explanation was provided for this question.'}`
    const timeout = window.setTimeout(() => {
      speakMessage(message)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [answerCorrect, answerExplanation, answerText, speakMessage])

  function toggleMuted() {
    const nextMuted = !muted
    onMutedChange(nextMuted)
    if (nextMuted) stopSpeaking()
  }

  function respondToReady(ready: boolean) {
    onReadyPromptResponse()
    if (ready) speakMessage(text)
    else stopSpeaking()
  }

  return (
    <div className="lilo-speech-widget">
      <div className="lilo-speech-stage">
        <div className={`lilo-cage${isSpeaking ? ' is-speaking' : ''}${motionEnabled ? ' is-motion-enabled' : ''}`}>
          <TtsMascot size={240} variant="idle" speaking={isSpeaking} reaction={reaction} motionEnabled={motionEnabled} />
        </div>
        {voiceLoading && <p className="mascot-voice-loading" role="status">Preparing Lilo’s voice…</p>}
        {readyPromptOpen && (
          <section className="lilo-ready-prompt" role="group" aria-labelledby="lilo-ready-prompt-title">
            <p id="lilo-ready-prompt-title">Are you ready?</p>
            <div className="lilo-ready-prompt__actions">
              <Button variant="primary" size="sm" onClick={() => respondToReady(true)} disabled={!text.trim()}>
                Yes
              </Button>
              <Button variant="outline" size="sm" onClick={() => respondToReady(false)}>
                No
              </Button>
            </div>
          </section>
        )}
      </div>
      <div className="lilo-speech-actions">
        <Button
          className="lilo-speech-launcher"
          variant={muted ? 'danger' : 'outline'}
          size="sm"
          leftIcon={muted ? 'volume-x' : 'volume-2'}
          aria-label={muted ? 'Unmute Lilo' : 'Mute Lilo'}
          aria-pressed={muted}
          onClick={toggleMuted}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button
          className="lilo-motion-toggle"
          variant="ghost"
          size="sm"
          aria-label="Lilo animations"
          aria-pressed={motionEnabled}
          onClick={toggleMotion}
        >
          Animations: {motionEnabled ? 'On' : 'Off'}
        </Button>
      </div>

      {spokenText && (
        <section className="lilo-speech-transcript" role="status" aria-live="polite" aria-atomic="true">
          <div className="lilo-speech-bubble__heading">
            <Icon name="volume-2" size={16} aria-hidden="true" />
            <span>{voiceLoading ? 'Lilo is preparing to speak' : isSpeaking ? 'Lilo is speaking' : 'Lilo said'}</span>
          </div>
          <p>{spokenText}</p>
        </section>
      )}
    </div>
  )
}
