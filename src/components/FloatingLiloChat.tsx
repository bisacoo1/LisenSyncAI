import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import liloAvatar from '@/assets/lilo-chat-avatar.png'
import { chatWithLilo } from '@/lib/ai'
import { findAppDestination, type AppDestination } from '@/lib/appNavigation'
import type { BoardProgramKey, StudyTrack } from '@/types'

interface FloatingLiloChatProps {
  program: BoardProgramKey
  track: StudyTrack
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  destination?: AppDestination
}

interface WidgetBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export default function FloatingLiloChat({ program, track }: FloatingLiloChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const messageSequence = useRef(0)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    bounds: WidgetBounds
    moved: boolean
    moveListener: (event: PointerEvent) => void
    endListener: (event: PointerEvent) => void
  } | null>(null)
  const suppressLauncherClick = useRef(false)

  const closeChat = useCallback(() => {
    setIsOpen(false)
    window.requestAnimationFrame(() => launcherRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChat()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [closeChat, isOpen])

  useEffect(() => () => {
    const drag = dragRef.current
    if (!drag) return
    window.removeEventListener('pointermove', drag.moveListener)
    window.removeEventListener('pointerup', drag.endListener)
    window.removeEventListener('pointercancel', drag.endListener)
  }, [])

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [isLoading, messages])

  function nextMessageId() {
    messageSequence.current += 1
    return `lilo-message-${messageSequence.current}`
  }

  function clearChat() {
    if (isLoading) return
    setMessages([])
    setQuestion('')
    setError(null)
  }

  function getWidgetBounds(): WidgetBounds | null {
    const widget = widgetRef.current
    if (!widget) return null
    const widgetBounds = widget.getBoundingClientRect()
    const panelBounds = widget.querySelector<HTMLElement>('.ask-lilo-chat-panel')?.getBoundingClientRect()
    return {
      left: Math.min(widgetBounds.left, panelBounds?.left ?? widgetBounds.left),
      right: Math.max(widgetBounds.right, panelBounds?.right ?? widgetBounds.right),
      top: Math.min(widgetBounds.top, panelBounds?.top ?? widgetBounds.top),
      bottom: Math.max(widgetBounds.bottom, panelBounds?.bottom ?? widgetBounds.bottom),
    }
  }

  function constrainPosition(x: number, y: number, baseX: number, baseY: number, bounds: WidgetBounds) {
    const margin = 12
    return {
      x: Math.max(baseX + margin - bounds.left, Math.min(baseX + window.innerWidth - margin - bounds.right, x)),
      y: Math.max(baseY + margin - bounds.top, Math.min(baseY + window.innerHeight - margin - bounds.bottom, y)),
    }
  }

  function startDragging(event: ReactPointerEvent<HTMLElement>) {
    suppressLauncherClick.current = false
    if (event.button !== 0) return
    const interactiveTarget = event.target instanceof Element
      ? event.target.closest('button, a, input, textarea, select')
      : null
    if (interactiveTarget && interactiveTarget !== event.currentTarget) return

    const bounds = getWidgetBounds()
    if (!bounds) return
    const moveListener = (moveEvent: PointerEvent) => moveWidget(moveEvent)
    const endListener = (endEvent: PointerEvent) => stopDragging(endEvent)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      bounds,
      moved: false,
      moveListener,
      endListener,
    }
    window.addEventListener('pointermove', moveListener)
    window.addEventListener('pointerup', endListener)
    window.addEventListener('pointercancel', endListener)
  }

  function moveWidget(event: PointerEvent) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return

    drag.moved = true
    setIsDragging(true)
    setPosition(constrainPosition(
      drag.originX + deltaX,
      drag.originY + deltaY,
      drag.originX,
      drag.originY,
      drag.bounds,
    ))
    event.preventDefault()
  }

  function stopDragging(event: PointerEvent) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    window.removeEventListener('pointermove', drag.moveListener)
    window.removeEventListener('pointerup', drag.endListener)
    window.removeEventListener('pointercancel', drag.endListener)
    setIsDragging(false)
    if (drag.moved) suppressLauncherClick.current = true
  }

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = question.trim()
    if (!message || isLoading) return

    const userMessage: ChatMessage = { id: nextMessageId(), role: 'user', content: message }
    setMessages(current => [...current, userMessage])
    setError(null)
    const destination = findAppDestination(message)
    if (destination) {
      const direction = destination.title === 'Upload materials'
        ? 'Open Upload materials to add a reviewer. Supported files include PDF, DOCX, PPT/PPTX, JPG/JPEG, PNG, WebP, HEIC, and HEIF.'
        : `You can find ${destination.title} in the workspace navigation. Use this link to open it.`
      setMessages(current => [
        ...current,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: direction,
          destination,
        },
      ])
      setQuestion('')
      return
    }

    setIsLoading(true)
    try {
      const response = await chatWithLilo({
        message,
        history: messages.map(({ role, content }) => ({ role, content })),
        program,
        track,
      })
      setMessages(current => [...current, { id: nextMessageId(), role: 'assistant', content: response.answer }])
      setQuestion('')
    } catch (requestError) {
      setMessages(current => current.filter(entry => entry.id !== userMessage.id))
      setError(requestError instanceof Error ? requestError.message : 'Lilo could not respond. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      ref={widgetRef}
      className={`ask-lilo-widget${isDragging ? ' ask-lilo-widget--dragging' : ''}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      {isOpen && (
        <section
          id="ask-lilo-chat-panel"
          className="ask-lilo-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ask-lilo-title"
        >
          <header
            className="ask-lilo-header"
            onPointerDown={startDragging}
          >
            <img className="ask-lilo-header-avatar" src={liloAvatar} alt="" draggable={false} />
            <div className="ask-lilo-header-copy">
              <strong id="ask-lilo-title">Ask Lilo</strong>
              <span>Your Pharmacy study companion</span>
            </div>
            <button
              className="ask-lilo-clear"
              type="button"
              onClick={clearChat}
              disabled={isLoading || (!messages.length && !error && !question)}
            >
              Clear chat
            </button>
            <button className="ask-lilo-close" type="button" onClick={closeChat} aria-label="Close Ask Lilo chat">
              ×
            </button>
          </header>

          <div className="ask-lilo-messages" ref={conversationRef} role="log" aria-label="Chat with Lilo" aria-live="polite">
            {messages.length === 0 && (
              <div className="ask-lilo-message ask-lilo-message--assistant">
                <p>Hi! I’m Lilo. Ask me about Pharmacy or where to find a feature.</p>
              </div>
            )}
            {messages.map(message => (
              <div
                key={message.id}
                className={`ask-lilo-message ask-lilo-message--${message.role}`}
              >
                <p>{message.content}</p>
                {message.destination && (
                  <Link
                    className="ask-lilo-nav-link"
                    to={message.destination.path}
                    onClick={closeChat}
                  >
                    Open {message.destination.title}
                  </Link>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="ask-lilo-message ask-lilo-message--assistant" role="status">
                <p>Lilo is thinking…</p>
              </div>
            )}
            {error && <p className="ask-lilo-error" role="alert">{error}</p>}
          </div>

          <form className="ask-lilo-form" onSubmit={sendQuestion}>
            <label className="sr-only" htmlFor="ask-lilo-question">Ask Lilo a question</label>
            <input
              id="ask-lilo-question"
              ref={inputRef}
              type="text"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="Ask a Pharmacy question…"
              maxLength={2000}
              disabled={isLoading}
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading || !question.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <div className="ask-lilo-launcher-row">
        {!isOpen && <span className="ask-lilo-launcher-label" aria-hidden="true">Ask Lilo</span>}
        <button
          ref={launcherRef}
          className="ask-lilo-launcher"
          type="button"
          aria-label={isOpen ? 'Close Ask Lilo chat' : 'Open Ask Lilo chat'}
          title="Drag to move"
          aria-expanded={isOpen}
          aria-controls="ask-lilo-chat-panel"
          aria-haspopup="dialog"
          onPointerDown={startDragging}
          onKeyDown={() => { suppressLauncherClick.current = false }}
          onClick={() => {
            if (suppressLauncherClick.current) {
              suppressLauncherClick.current = false
              return
            }
            isOpen ? closeChat() : setIsOpen(true)
          }}
        >
          <img src={liloAvatar} alt="" draggable={false} />
        </button>
      </div>
    </div>
  )
}
