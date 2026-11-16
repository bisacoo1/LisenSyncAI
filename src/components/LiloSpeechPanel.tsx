import { useEffect, useRef, useState } from 'react'
import { TtsMascot } from '@/components/ui/TtsMascot'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

interface LiloSpeechPanelProps {
  text: string
}

const LILO_LINES = [
  "Okay, let's take this one step at a time.",
  "Ready ka na? We can go through this slowly.",
  "Let's gently focus on the key details.",
  "Take your time. Kaya mo 'yan.",
]

export default function LiloSpeechPanel({ text }: LiloSpeechPanelProps) {
  const { addToast } = useToast()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const nextLine = useRef(0)
  const speechVersion = useRef(0)
  const voices = useRef<SpeechSynthesisVoice[]>([])

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

  function speak() {
    const message = text.trim()
    if (!message) return
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      addToast({
        type: 'error',
        title: 'Read aloud is unavailable',
        message: 'Try a browser that supports speech synthesis.',
      })
      return
    }

    const line = LILO_LINES[nextLine.current % LILO_LINES.length]
    nextLine.current += 1
    const fullText = `${line} ${message}`
    const version = ++speechVersion.current
    const utterance = new SpeechSynthesisUtterance(fullText)
    const voice = voices.current.find(candidate => /^(en-ph|fil-ph|tl-ph)\b/i.test(candidate.lang))
      ?? voices.current.find(candidate => /\b(filipino|tagalog)\b/i.test(candidate.name))
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
    setSpokenText(fullText)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="lilo-speech-widget">
      <TtsMascot size={240} variant="idle" speaking={isSpeaking} />
      <Button
        className="lilo-speech-launcher"
        variant="outline"
        size="sm"
        leftIcon={isSpeaking ? 'x' : 'volume-2'}
        aria-pressed={isSpeaking}
        onClick={isSpeaking ? stopSpeaking : speak}
        disabled={!text.trim()}
      >
        {isSpeaking ? 'Stop speaking' : 'Listen with Lilo'}
      </Button>

      {isSpeaking && (
        <section className="lilo-speech-bubble" role="status" aria-live="polite">
          <div className="lilo-speech-bubble__heading">
            <Icon name="volume-2" size={16} />
            <span>Lilo is speaking</span>
          </div>
          <p>{spokenText}</p>
        </section>
      )}
    </div>
  )
}
