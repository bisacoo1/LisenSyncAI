import { useEffect, useState } from 'react'
import { explainText } from '@/lib/ai'
import type { BoardProgramKey } from '@/types'
import { Button, Icon, Spinner, useToast } from '@/components/ui'

interface AiHelperProps {
  /** Text describing the question, options, correct answer, and rationale */
  contextText: string
  program: BoardProgramKey
  subject: string
  /** Changes per question so state resets automatically */
  itemKey: string
}

export default function AiHelper({ contextText, program, subject, itemKey }: AiHelperProps) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<{ q: string; a: string }[]>([])

  useEffect(() => {
    setOpen(false)
    setExplanation(null)
    setQuestion('')
    setThread([])
    setLoading(false)
  }, [itemKey])

  async function explain() {
    if (loading || !contextText) return
    setLoading(true)
    try {
      const r = await explainText({ selectedText: contextText, program, subject })
      setExplanation(r.explanation)
      setOpen(true)
    } catch (e: any) {
      addToast({ type: 'error', title: 'AI explanation failed', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function ask() {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    try {
      const r = await explainText({ selectedText: contextText, followUp: q, program, subject })
      setThread(t => [...t, { q, a: r.explanation }])
      setQuestion('')
    } catch (e: any) {
      addToast({ type: 'error', title: 'AI request failed', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 12 }}>
        <Button variant="outline" size="sm" leftIcon="brain" onClick={explain} loading={loading}>
          {loading ? 'Thinking…' : 'Ask AI to explain'}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, padding: 16, background: 'var(--panel-2)', border: '1px solid var(--primary-border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon name="brain" size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>AI Explanation</span>
      </div>

      {loading && !explanation && !thread.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
          <Spinner size="sm" /> Thinking…
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>
          {explanation}
        </div>
      )}

      {thread.map((t, i) => (
        <div key={i} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>You: {t.q}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{t.a}</div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && ask()}
          placeholder="Ask a follow-up question…"
          disabled={loading}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: 13 }}
        />
        <Button variant="primary" size="sm" onClick={ask} loading={loading} disabled={!question.trim()}>
          Ask
        </Button>
      </div>
    </div>
  )
}
