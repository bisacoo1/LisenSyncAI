import { useEffect, useRef, useState } from 'react'
import { TtsMascot } from '@/components/ui/TtsMascot'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

interface LiloSpeechPanelProps {
  text: string
}

const LILO_LINES = [
  "Ready? Let's take this one step at a time.",
  "Take a breath. You've got this.",
  "Listen for the key details in this one.",
  "Let's focus on what the question is asking.",
]

export default function LiloSpeechPanel({ text }: LiloSpeechPanelProps) {
  const { addToast } = useToast()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const nextLine = useRef(0)
  const speechVersion = useRef(0)

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
    utterance.lang = 'en-US'
    utterance.rate = 0.94
    utterance.pitch = 1.08
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
