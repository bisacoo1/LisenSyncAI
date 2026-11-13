import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { explainText } from '@/lib/ai'
import type { ReviewMaterial, DocumentHighlight } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, Input, EmptyState, useToast } from '@/components/ui'

interface HighlightBubbleProps {
  text: string
  onExplain: () => void
  onHighlight: () => void
  onClose: () => void
  style: React.CSSProperties
}

function HighlightBubble({ text, onExplain, onHighlight, onClose, style }: HighlightBubbleProps) {
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1000,
        background: 'var(--panel)',
        border: '1px solid var(--primary-border)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        padding: 12,
        minWidth: 160,
        ...style,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Text selected
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        “{text.length > 60 ? text.slice(0, 60) + '…' : text}”
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" size="sm" onClick={onExplain} fullWidth leftIcon="brain">
          Explain with AI
        </Button>
        <Button variant="outline" size="sm" onClick={onHighlight} fullWidth leftIcon="check-circle">
          Highlight
        </Button>
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  )
}

export default function SideBySideReader() {
  const { profile, user } = useAuth()
  const nav = useNavigate()
  const { materialId } = useParams<{ materialId: string }>()
  const { addToast } = useToast()

  const [material, setMaterial] = useState<ReviewMaterial | null>(null)
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedText, setSelectedText] = useState('')
  const [explaining, setExplaining] = useState(false)
  const [currentExplanation, setCurrentExplanation] = useState<{ text: string; explanation: string; model: string } | null>(null)
  const [followUpInput, setFollowUpInput] = useState('')
  const [sendingFollowUp, setSendingFollowUp] = useState(false)
  const [bubble, setBubble] = useState<{ x: number; y: number; text: string } | null>(null)
  const [followUps, setFollowUps] = useState<{ question: string; answer: string }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 4

  const textRef = useRef<HTMLDivElement>(null)
  const selectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!materialId) return
    loadMaterial()
  }, [materialId])

  async function loadMaterial() {
    if (!profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('review_materials')
        .select('*')
        .eq('id', materialId)
        .eq('user_id', profile.id)
        .maybeSingle()
      if (error) throw error
      setMaterial(data as ReviewMaterial | null)

      const { data: hl } = await supabase
        .from('document_highlights')
        .select('*')
        .eq('material_id', materialId)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      setHighlights((hl as DocumentHighlight[]) || [])
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !material) {
    return (
      <div className="container" style={{ paddingTop: 60, paddingBottom: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 108px)' }}>
        <Card variant="outlined">
          <CardContent style={{ padding: 48, textAlign: 'center' }}>
            <Icon name="loader" size={40} className="spin" />
            <p style={{ marginTop: 16, color: 'var(--muted)' }}>Loading document…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const mat = material!
  const paragraphs = (mat.extracted_text || '').split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const totalPages = Math.max(1, Math.ceil(paragraphs.length / ITEMS_PER_PAGE))
  const pageParagraphs = paragraphs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function handleSelectionChange(e: React.UIEvent) {
    if (selectionTimeout.current) clearTimeout(selectionTimeout.current)
    selectionTimeout.current = setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() || ''
      if (text.length > 3 && textRef.current && textRef.current.contains(sel?.anchorNode as Node)) {
        const rect = sel?.getRangeAt(0).getBoundingClientRect()
        setBubble({
          x: rect?.left ?? 0,
          y: (rect?.top ?? 0) - 80,
          text,
        })
        setSelectedText(text)
      } else {
        setBubble(null)
        setSelectedText('')
      }
    }, 100)
  }

  async function handleExplain() {
    if (!selectedText || !profile || !user) return
    setExplaining(true)
    try {
      const result = await explainText({
        selectedText,
        program: mat.board_program,
        subject: mat.subject,
      })

      setCurrentExplanation({ text: selectedText, explanation: result.explanation, model: result.model })
      setBubble(null)

      const { error } = await supabase.from('document_highlights').insert({
        user_id: user.id,
        material_id: mat.id,
        selected_text: selectedText,
        explanation: result.explanation,
        ai_model: result.model,
      })
      if (error) throw error

      await loadMaterial()
      addToast({ type: 'success', title: 'Explained', message: 'AI explanation added to side panel' })
    } catch (e: any) {
      addToast({ type: 'error', title: 'Explanation failed', message: e.message })
    } finally {
      setExplaining(false)
    }
  }

  async function handleHighlight() {
    if (!selectedText || !profile || !user) return
    try {
      const { error } = await supabase.from('document_highlights').insert({
        user_id: user.id,
        material_id: mat.id,
        selected_text: selectedText,
        explanation: null,
        ai_model: null,
      })
      if (error) throw error
      await loadMaterial()
      setBubble(null)
      setSelectedText('')
      addToast({ type: 'success', title: 'Highlighted', message: 'Text saved to highlights' })
    } catch (e: any) {
      addToast({ type: 'error', title: 'Highlight failed', message: e.message })
    }
  }

  async function sendFollowUp() {
    if (!followUpInput.trim() || !currentExplanation || !profile || !user) return
    setSendingFollowUp(true)
    try {
      const result = await explainText({
        selectedText: currentExplanation.text,
        followUp: followUpInput,
        program: mat.board_program,
        subject: mat.subject,
      })

      const newFollowUps = [...followUps, { question: followUpInput, answer: result.explanation }]
      setFollowUps(newFollowUps)
      setFollowUpInput('')

      const { error } = await supabase.from('document_highlights').insert({
        user_id: user.id,
        material_id: mat.id,
        selected_text: currentExplanation.text,
        explanation: result.explanation,
        ai_model: result.model,
      })
      if (error) throw error

      await loadMaterial()
    } catch (e: any) {
      addToast({ type: 'error', title: 'Follow-up failed', message: e.message })
    } finally {
      setSendingFollowUp(false)
    }
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 48, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 108px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="ghost" size="icon" onClick={() => nav('/reviewer')} leftIcon="chevron-left" />
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Side by Side Reader</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
              {mat.title} · {mat.subject}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge variant="primary" size="sm">
            <Icon name="file-text" size={12} style={{ marginRight: 6 }} />
            {mat.mime_type || 'Document'}
          </Badge>
          <Badge variant={highlights.length > 0 ? 'success' : 'default'} size="sm">
            <Icon name="check-circle" size={12} style={{ marginRight: 6 }} />
            {highlights.length} highlights
          </Badge>
        </div>
      </div>

      {/* Main reader area - AI panel left, document right */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: AI panel */}
        <div
          style={{
            width: 400,
            minWidth: 400,
            background: 'var(--panel)',
            borderRight: '1px solid var(--border)',
            boxShadow: '4px 0 16px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="brain" size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>AI Assistant</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              {currentExplanation ? `Model: ${currentExplanation.model}` : `${highlights.length} saved`}
            </p>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Saved highlights section */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Saved Highlights ({highlights.length})
              </h4>
              {highlights.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
                  No highlights yet. Select text in the document and tap 'Highlight'.
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {highlights.map(h => (
                    <li
                      key={h.id}
                      style={{ padding: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms ease' }}
                      onClick={() => setCurrentExplanation(h.explanation ? { text: h.selected_text, explanation: h.explanation, model: h.ai_model || 'unknown' } : null)}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', maxHeight: 48, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box' }}>
                        {h.selected_text}
                      </div>
                      {h.explanation ? (
                        <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                          <Icon name="brain" size={12} style={{ marginRight: 4 }} />
                          AI explained — tap to view
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Highlighted (no explanation)</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Current explanation section */}
            {currentExplanation && (
              <>
                <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Selected text
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.6 }}>
                    “{currentExplanation.text}”
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Explanation
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {currentExplanation.explanation}
                  </div>
                </div>

                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Follow-up question
                </h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="Ask a follow-up question…"
                    value={followUpInput}
                    onChange={e => setFollowUpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendFollowUp()}
                    fullWidth
                    leftIcon="comment"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={sendFollowUp}
                    disabled={!followUpInput.trim() || sendingFollowUp}
                    loading={sendingFollowUp}
                    leftIcon="arrow-right"
                  >
                    Ask
                  </Button>
                </div>

                {followUps.length > 0 && (
                  <div>
                    <h4 style={{ margin: '16px 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Conversation
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {followUps.map((f, i) => (
                        <div key={i} style={{ padding: 10, background: 'var(--panel-2)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>You:</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{f.question}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>AI:</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>{f.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!currentExplanation && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)' }}>
                <Icon name="check-circle" size={48} style={{ opacity: 0.4 }} />
                <p style={{ fontSize: 14, marginBottom: 16 }}>No explanation yet</p>
                <p style={{ fontSize: 12, maxWidth: 260, lineHeight: 1.6 }}>Select text in the document and tap 'Explain with AI' to start.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Document viewer */}
        <div
          style={{
            background: 'var(--bg)',
            overflow: 'auto',
            borderLeft: '1px solid var(--border)',
            minHeight: 0,
          }}
        >
          <Card variant="outlined" style={{ margin: 16, borderRadius: 12 }}>
            <CardContent style={{ padding: 0 }}>
              <div
                ref={textRef}
                onMouseUp={handleSelectionChange}
                style={{
                  lineHeight: 1.8,
                  fontSize: 16,
                  color: 'var(--text)',
                  userSelect: 'text',
                  cursor: 'text',
                  padding: 20,
                  minHeight: '100%',
                }}
              >
                {paragraphs.length === 0 ? (
                  <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>
                    No text content available for this document.
                  </div>
                ) : (
                  <>
                    {pageParagraphs.map((p, i) => (
                      <p key={i} style={{ margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>
                        {p}
                      </p>
                    ))}
                    {/* Page number marker */}
                    <div style={{ textAlign: 'center', marginTop: 30, color: 'var(--muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Page {currentPage} of {totalPages}
                    </div>
                  </>
                )}
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--panel-2)', borderRadius: '0 0 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    fullWidth
                    style={{ minWidth: 100 }}
                  >
                    <Icon name="chevron-left" size={16} style={{ marginRight: 6 }} />
                    Previous
                  </Button>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                    {currentPage} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    fullWidth
                    style={{ minWidth: 100 }}
                  >
                    Next <Icon name="chevron-right" size={16} style={{ marginLeft: 6 }} />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating explain/highlight bubble */}
      {bubble && (
        <HighlightBubble
          text={bubble.text}
          onExplain={handleExplain}
          onHighlight={handleHighlight}
          onClose={() => setBubble(null)}
          style={{ left: bubble.x, top: bubble.y }}
        />
      )}
    </div>
  )
}
