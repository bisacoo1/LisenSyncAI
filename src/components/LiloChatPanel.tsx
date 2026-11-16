import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BoardProgramKey } from '@/types'
import { explainText } from '@/lib/ai'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

interface LiloChatPanelProps {
  contextText: string
  conversationKey: string
  program: BoardProgramKey
  subject: string
}

export default function LiloChatPanel({
  contextText,
  conversationKey,
  program,
  subject,
}: LiloChatPanelProps) {
  const { addToast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const requestVersion = useRef(0)
  const nextMessageId = useRef(0)
  const conversationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestVersion.current += 1
    setMessages([])
    setDraft('')
    setLoading(false)
    return () => {
      requestVersion.current += 1
    }
  }, [conversationKey])

  useEffect(() => {
    const conversation = conversationRef.current
    if (conversation) conversation.scrollTop = conversation.scrollHeight
  }, [messages, loading])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = draft.trim()
    if (!question || loading || !contextText.trim()) return

    const request = requestVersion.current
    const previousMessages = messages
    const updatedMessages = [
      ...messages,
      { id: nextMessageId.current++, role: 'user' as const, text: question },
    ]
    const transcript = updatedMessages
      .slice(-12)
      .map(message => `${message.role === 'user' ? 'Student' : 'Lilo'}: ${message.text}`)
      .join('\n')

    setMessages(updatedMessages)
    setDraft('')
    setLoading(true)

    try {
      const response = await explainText({
        selectedText: contextText,
        followUp: `Conversation so far:\n${transcript}\n\nReply to the student's latest message.`,
        program,
        subject,
      })
      if (request !== requestVersion.current) return
      setMessages(current => [
        ...current,
        { id: nextMessageId.current++, role: 'assistant', text: response.explanation },
      ])
    } catch (error) {
      if (request !== requestVersion.current) return
      setMessages(previousMessages)
      setDraft(question)
      addToast({
        type: 'error',
        title: 'Lilo couldn’t reply',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (request === requestVersion.current) setLoading(false)
    }
  }

  return (
    <section className="lilo-chat-panel" aria-label="Chat with Lilo">
      <header className="lilo-chat-header">
        <span className="lilo-chat-header-icon"><Icon name="comment" size={18} /></span>
        <div>
          <h2>Chat with Lilo</h2>
          <p>Ask about your study material</p>
        </div>
      </header>

      <div
        ref={conversationRef}
        className="lilo-chat-messages"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        <article className="lilo-chat-message lilo-chat-message--assistant">
          <span className="lilo-chat-sender">Lilo</span>
          <p>
            {subject
              ? `Hi! I’m here to help with ${subject}. What would you like to know?`
              : 'Hi! Choose a subject to start studying together.'}
          </p>
        </article>
        {messages.map(message => (
          <article
            key={message.id}
            className={`lilo-chat-message lilo-chat-message--${message.role}`}
          >
            <span className="lilo-chat-sender">{message.role === 'user' ? 'You' : 'Lilo'}</span>
            <p>{message.text}</p>
          </article>
        ))}
        {loading && (
          <div className="lilo-chat-thinking" role="status">
            <Icon name="loader" size={15} />
            <span>Lilo is thinking…</span>
          </div>
        )}
      </div>

      <form className="lilo-chat-form" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="lilo-chat-input">Message Lilo</label>
        <textarea
          id="lilo-chat-input"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder={contextText ? 'Ask Lilo a question…' : 'Choose a subject to start chatting'}
          rows={2}
          disabled={!contextText.trim() || loading}
        />
        <Button
          type="submit"
          size="md"
          leftIcon="arrow-up-right"
          disabled={!draft.trim() || !contextText.trim() || loading}
          loading={loading}
        >
          Send
        </Button>
      </form>
    </section>
  )
}
