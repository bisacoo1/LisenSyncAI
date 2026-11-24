import { useCallback, useEffect, useRef, useState } from 'react'
import { TtsMascot } from '@/components/ui/TtsMascot'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import useReducedMotion from '@/hooks/useReducedMotion'

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
  const [spokenText, setSpokenText] = useState('')
  const speechVersion = useRef(0)
  const voices = useRef<SpeechSynthesisVoice[]>([])
  const readyPromptSpoken = useRef(false)
  const mutedRef = useRef(muted)
  const motionEnabled = motionOverride ?? !prefersReducedMotion
  mutedRef.current = muted

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const updateVoices = () => {
      voices.current = window.speechSynthesis.getVoices()
    }
    updateVoices()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
  }, [])

  useEffect(() => () => {
    speechVersion.current += 1
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  function stopSpeaking() {
    speechVersion.current += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
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
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      addToast({
        type: 'error',
        title: 'Read aloud is unavailable',
        message: 'Try a browser that supports speech synthesis.',
      })
      return
    }

    const version = ++speechVersion.current
    const utterance = new SpeechSynthesisUtterance(cleanMessage)
    const voice = voices.current.find(candidate => /\bmicrosoft mark\b/i.test(candidate.name))
      ?? voices.current.find(candidate => /^(en-ph|fil-ph|tl-ph)\b/i.test(candidate.lang))
      ?? voices.current.find(candidate => /\b(filipino|tagalog)\b/i.test(candidate.name))
      ?? voices.current.find(candidate => /\bzira\b/i.test(candidate.name))
      ?? voices.current.find(candidate => /^en-/i.test(candidate.lang))
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = /^(en|fil|tl)-ph/i.test(navigator.language) ? navigator.language : 'en-US'
    }
    utterance.rate = 0.86
    utterance.pitch = 1.02
    utterance.volume = 0.78
    utterance.onstart = () => {
      if (version === speechVersion.current) setIsSpeaking(true)
    }
    utterance.onend = () => {
      if (version === speechVersion.current) setIsSpeaking(false)
    }
    utterance.onerror = event => {
      if (version !== speechVersion.current || event.error === 'canceled') return
      setIsSpeaking(false)
      addToast({
        type: 'error',
        title: 'Lilo could not speak',
        message: `Speech playback failed: ${event.error}.`,
      })
    }

    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel()
    setSpokenText(cleanMessage)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
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
            <span>{isSpeaking ? 'Lilo is speaking' : 'Lilo said'}</span>
          </div>
          <p>{spokenText}</p>
        </section>
      )}
    </div>
  )
}
