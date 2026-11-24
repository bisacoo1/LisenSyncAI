import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { explainText } from '@/lib/ai'
import { formatStudyText } from '@/lib/formatStudyText'
import StudyMarkdown from '@/components/StudyMarkdown'
import type { ReviewMaterial, DocumentHighlight } from '@/types'
import { Card, CardContent, Button, Badge, Icon, EmptyState, useToast } from '@/components/ui'

interface HighlightBubbleProps {
  text: string
  onExplain: () => void
  onHighlight: () => void
  onClose: () => void
  busy: boolean
  style: React.CSSProperties
}

function HighlightBubble({ text, onExplain, onHighlight, onClose, busy, style }: HighlightBubbleProps) {
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
        width: 'min(320px, calc(100vw - 24px))',
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
        <Button variant="primary" size="sm" onClick={onExplain} disabled={busy} fullWidth leftIcon="brain">
          Explain with AI
        </Button>
        <Button variant="outline" size="sm" onClick={onHighlight} disabled={busy} fullWidth leftIcon="check-circle">
          Highlight
        </Button>
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button
          aria-label="Close selection actions"
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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [panelTab, setPanelTab] = useState<'chat' | 'highlights'>('chat')
  const [mobileView, setMobileView] = useState<'document' | 'chat'>('document')
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const requestVersion = useRef(0)
  const chatRequestPending = useRef(false)
  const highlightPending = useRef(false)
  const [savingHighlight, setSavingHighlight] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  const textRef = useRef<HTMLDivElement>(null)
  const selectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 })
  }, [currentPage, materialId])

  useEffect(() => {
    if (!profile) return
    let active = true
    const userId = profile.id
    async function loadMaterial() {
      setLoading(true)
      setLoadError(false)
      setMaterial(null)
      setHighlights([])
      try {
        let query = supabase.from('review_materials').select('*').eq('user_id', userId)
        query = materialId ? query.eq('id', materialId) : query.order('created_at', { ascending: false }).limit(1)
        const { data, error } = await query.maybeSingle()
        if (error) throw error
        if (!active) return
        const found = data as ReviewMaterial | null
        setMaterial(found)
        if (!materialId && found) {
          nav(`/side-by-side/${found.id}`, { replace: true })
          return
        }
        if (found) {
          const { data: hl, error: highlightError } = await supabase.from('document_highlights')
            .select('*').eq('material_id', found.id).eq('user_id', userId)
            .order('created_at', { ascending: false })
          if (!active) return
          if (highlightError) addToast({ type: 'error', title: 'Could not load highlights', message: highlightError.message })
          else setHighlights((hl as DocumentHighlight[]) || [])
        }
      } catch (e: any) {
        if (active) {
          setLoadError(true)
          addToast({ type: 'error', title: 'Could not load reviewer', message: e.message })
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadMaterial()
    return () => { active = false }
  }, [materialId, profile?.id])

  useEffect(() => {
    requestVersion.current += 1
    chatRequestPending.current = false
    highlightPending.current = false
    setSavingHighlight(false)
    setMessages([])
    setCurrentExplanation(null)
    setFollowUpInput('')
    setSendingFollowUp(false)
    setExplaining(false)
    setCurrentPage(1)
    setBubble(null)
    setSelectedText('')
    setMobileView('document')
    return () => {
      requestVersion.current += 1
      if (selectionTimeout.current) clearTimeout(selectionTimeout.current)
    }
  }, [materialId, profile?.id])

  useEffect(() => {
    const messagesPanel = chatMessagesRef.current
    if (messagesPanel) messagesPanel.scrollTop = messagesPanel.scrollHeight
  }, [messages, sendingFollowUp, explaining, panelTab, mobileView])

  if (loading) {
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

  if (!material) {
    return (
      <div className="container" style={{ paddingTop: 60, paddingBottom: 48 }}>
        <EmptyState
          icon="book-open"
          title={loadError ? "Could not load reviewer" : "No reviewer available"}
          description={loadError ? "Please try again or choose a reviewer from your library." : "Upload a reviewer first, then open the side-by-side reader."}
          action={
            {
              label: loadError ? 'Open my reviewers' : 'Upload reviewer',
              onClick: () => nav(loadError ? '/reviewers' : '/reviewer?tab=upload'),
              variant: 'primary',
            }
          }
        />
      </div>
    )
  }

  const mat = material!
  const paragraphs = (mat.extracted_text || '').split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const totalPages = Math.max(1, Math.ceil(paragraphs.length / ITEMS_PER_PAGE))
  const pageParagraphs = paragraphs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function handleSelectionChange() {
    if (selectionTimeout.current) clearTimeout(selectionTimeout.current)
    selectionTimeout.current = setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() || ''
      if (text.length > 3 && textRef.current && textRef.current.contains(sel?.anchorNode as Node)) {
        const rect = sel?.getRangeAt(0).getBoundingClientRect()
        setBubble({
          x: Math.max(12, Math.min(rect?.left ?? 12, window.innerWidth - Math.min(320, window.innerWidth - 24) - 12)),
          y: Math.max(12, Math.min((rect?.top ?? 0) - 130, window.innerHeight - 200)),
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
    const text = bubble?.text || selectedText
    if (!text || !profile || !user || chatRequestPending.current) return
    chatRequestPending.current = true
    const version = requestVersion.current
    setBubble(null)
    setPanelTab('chat')
    setMobileView('chat')
    setCurrentExplanation(null)
    setMessages([{ role: 'user', content: `Explain this passage:\n\n${text}` }])
    setExplaining(true)
    try {
      const result = await explainText({ selectedText: text, program: mat.board_program, subject: mat.subject })
      if (version !== requestVersion.current) return
      setCurrentExplanation({ text, explanation: result.explanation, model: result.model })
      setMessages(previous => [...previous, { role: 'assistant', content: result.explanation }])
      try {
        const { data, error } = await supabase.from('document_highlights').insert({
          user_id: user.id, material_id: mat.id, selected_text: text,
          explanation: result.explanation, ai_model: result.model,
        }).select().single()
        if (version !== requestVersion.current) return
        if (error) throw error
        if (data) setHighlights(previous => [data as DocumentHighlight, ...previous])
      } catch (error: any) {
        if (version === requestVersion.current) addToast({ type: 'error', title: 'Explanation not saved', message: error.message })
      }
    } catch (e: any) {
      if (version !== requestVersion.current) return
      setMessages([])
      addToast({ type: 'error', title: 'Explanation failed', message: e.message })
    } finally {
      if (version === requestVersion.current) { chatRequestPending.current = false; setExplaining(false) }
    }
  }

  async function handleHighlight() {
    const text = bubble?.text || selectedText
    if (!text || !profile || !user || highlightPending.current) return
    const version = requestVersion.current
    highlightPending.current = true
    setSavingHighlight(true)
    try {
      const { data, error } = await supabase.from('document_highlights').insert({
        user_id: user.id, material_id: mat.id, selected_text: text, explanation: null, ai_model: null,
      }).select().single()
      if (version !== requestVersion.current) return
      if (error) throw error
      if (data) setHighlights(previous => [data as DocumentHighlight, ...previous])
      setBubble(null)
      setSelectedText('')
      addToast({ type: 'success', title: 'Highlighted', message: 'Text saved to highlights' })
    } catch (e: any) {
      if (version === requestVersion.current) addToast({ type: 'error', title: 'Highlight failed', message: e.message })
    } finally {
      if (version === requestVersion.current) { highlightPending.current = false; setSavingHighlight(false) }
    }
  }

  async function sendFollowUp() {
    const question = followUpInput.trim()
    if (!question || !profile || chatRequestPending.current) return
    const context = currentExplanation?.text || pageParagraphs.join('\n\n')
    if (!context.trim()) {
      addToast({ type: 'error', title: 'No document text', message: 'This page has no extracted text to discuss.' })
      return
    }
    chatRequestPending.current = true
    const version = requestVersion.current
    const history = messages
    setMessages(previous => [...previous, { role: 'user', content: question }])
    setFollowUpInput('')
    setSendingFollowUp(true)
    try {
      const result = await explainText({ selectedText: context, followUp: question, history, program: mat.board_program, subject: mat.subject })
      if (version !== requestVersion.current) return
      setMessages(previous => [...previous, { role: 'assistant', content: result.explanation }])
    } catch (e: any) {
      if (version !== requestVersion.current) return
      setMessages(history)
      setFollowUpInput(previous => previous.trim() ? `${question}\n\n${previous}` : question)
      addToast({ type: 'error', title: 'Message not sent', message: e.message })
    } finally {
      if (version === requestVersion.current) { chatRequestPending.current = false; setSendingFollowUp(false) }
    }
  }

  async function clearAllHighlights() {
    if (!profile || !user || explaining || savingHighlight || !window.confirm('Delete all saved highlights for this reviewer? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('document_highlights').delete().eq('material_id', mat.id).eq('user_id', user.id)
      if (error) throw error
      setHighlights([])
      addToast({ type: 'success', title: 'Cleared', message: 'All highlights deleted' })
    } catch (e: any) {
      addToast({ type: 'error', title: 'Delete failed', message: e.message })
    }
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || sendingFollowUp || explaining) return
    setCurrentPage(page)
    setBubble(null)
    if (!currentExplanation) setMessages([])
  }

  return (
    <div className="container reader-page">
      {/* Header */}
      <div className="reader-header" style={{ padding: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="ghost" size="icon" onClick={() => nav('/reviewer')} leftIcon="chevron-left" aria-label="Back to reviewer" />
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Side by Side Reader</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
              {mat.title} · {mat.subject}
            </p>
          </div>
        </div>
        <div className="reader-badges" style={{ display: 'flex', gap: 8 }}>
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

      <div className="reader-mobile-switch" role="group" aria-label="Reader view">
        <button type="button" className={mobileView === 'document' ? 'active' : ''} aria-pressed={mobileView === 'document'} onClick={() => setMobileView('document')}>Document</button>
        <button type="button" className={mobileView === 'chat' ? 'active' : ''} aria-pressed={mobileView === 'chat'} onClick={() => setMobileView('chat')}>AI chat</button>
      </div>
      {/* Main reader area - document left, AI panel right */}
      <div className={`reader-grid${chatCollapsed ? ' reader-grid--chat-collapsed' : ''}`}>
        {/* Left: Document viewer */}
        <div
          className={`reader-document${mobileView !== 'document' ? ' reader-mobile-hidden' : ''}`}
          style={{
            background: 'var(--bg)',
            borderRight: '1px solid var(--border)',
            minHeight: 0,
          }}
        >
          <Card variant="outlined" padding="none" className="reader-document-card">
            <CardContent className="reader-document-content">
              <div
                className="reader-document-text"
                ref={textRef}
                onMouseUp={handleSelectionChange}
                onTouchEnd={handleSelectionChange}
                onKeyUp={handleSelectionChange}
                style={{
                  lineHeight: 1.8,
                  fontSize: 16,
                  color: 'var(--text)',
                  userSelect: 'text',
                  cursor: 'text',
                }}
              >
                {paragraphs.length === 0 ? (
                  <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>
                    No text content available for this document.
                  </div>
                ) : (
                  <>
                    {pageParagraphs.map((p, i) => (
                      <StudyMarkdown key={i}>{p}</StudyMarkdown>
                    ))}
                    {/* Page number marker */}
                    <div style={{ textAlign: 'center', marginTop: 30, color: 'var(--muted)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Section {currentPage} of {totalPages}
                    </div>
                  </>
                )}
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="reader-pagination" aria-label="Document pagination">
                  <Button variant="outline" size="sm" leftIcon="chevron-left" aria-label="Previous page" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || sendingFollowUp || explaining}>
                    Previous
                  </Button>
                  <span aria-label={`Section ${currentPage} of ${totalPages}`}>{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" rightIcon="chevron-right" aria-label="Next page" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages || sendingFollowUp || explaining}>
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: AI panel */}
        {chatCollapsed ? (
          <aside className={`reader-side-panel reader-side-panel--collapsed${mobileView !== 'chat' ? ' reader-mobile-hidden' : ''}`} aria-label="Study assistant collapsed">
            <button type="button" className="reader-panel-collapse-toggle" aria-label="Expand study assistant" aria-expanded="false" title="Expand study assistant" onClick={() => setChatCollapsed(false)}>
              <Icon name="chevron-left" size={18} />
            </button>
          </aside>
        ) : (
          <aside className={`reader-side-panel${mobileView !== 'chat' ? ' reader-mobile-hidden' : ''}`} aria-label="Study assistant">
            <div className="reader-chat-header">
              <span className="reader-chat-avatar"><Icon name="brain" size={20} /></span>
              <div><strong>Study assistant</strong><small>Ask questions as you read</small></div>
              <button type="button" className="reader-panel-collapse-toggle" aria-label="Collapse study assistant" aria-expanded="true" title="Collapse study assistant" onClick={() => setChatCollapsed(true)}>
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
            <div className="reader-panel-tabs" role="group" aria-label="Assistant panel">
              <button type="button" className={panelTab === 'chat' ? 'active' : ''} aria-pressed={panelTab === 'chat'} onClick={() => setPanelTab('chat')}>Chat</button>
              <button type="button" className={panelTab === 'highlights' ? 'active' : ''} aria-pressed={panelTab === 'highlights'} onClick={() => setPanelTab('highlights')}>Saved highlights <span>{highlights.length}</span></button>
            </div>
            {panelTab === 'chat' ? (
              <>
                <div className="reader-chat-context">
                  <Icon name="file-text" size={15} />
                  <span>{currentExplanation ? 'Discussing selected text' : `Section ${currentPage} of ${totalPages}`}</span>
                  {currentExplanation && <button type="button" disabled={sendingFollowUp || explaining} onClick={() => { setCurrentExplanation(null); setMessages([]) }}>Clear selection</button>}
                </div>
                {currentExplanation && <div className="reader-chat-selection" title={formatStudyText(currentExplanation.text)}>“{formatStudyText(currentExplanation.text)}”</div>}
                <div ref={chatMessagesRef} className="reader-chat-messages" aria-label="Conversation" aria-live="polite" aria-busy={sendingFollowUp || explaining}>
                  {messages.length === 0 && !explaining && (
                    <div className="reader-chat-empty">
                      <span className="reader-chat-avatar"><Icon name="brain" size={24} /></span>
                      <h2>Let's study together.</h2>
                      <p>Ask a question about this section, or select a passage and choose “Explain with AI”.</p>
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <div key={index} className={`reader-message reader-message--${message.role}`}>
                      <span>{message.role === 'user' ? 'You' : 'Study assistant'}</span>
                      <StudyMarkdown>{message.content}</StudyMarkdown>
                    </div>
                  ))}
                  {(sendingFollowUp || explaining) && <div className="reader-chat-thinking" role="status"><Icon name="loader" size={15} className="spin" /> Thinking…</div>}
                </div>
                <form className="reader-chat-composer" onSubmit={event => { event.preventDefault(); void sendFollowUp() }}>
                  <div>
                    <textarea id="reader-chat-input" aria-label="Ask a follow-up question" rows={2} placeholder="Ask a follow-up question…" value={followUpInput} onChange={event => setFollowUpInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendFollowUp() } }} />
                    <Button type="submit" variant="primary" size="sm" disabled={!followUpInput.trim() || sendingFollowUp || explaining || (!currentExplanation && !paragraphs.length)} aria-label="Send question" leftIcon="arrow-right">Send</Button>
                  </div>
                  <small>Enter to send · Shift + Enter for a new line. Chat is not saved.</small>
                  <small>AI can make mistakes. Verify important information.</small>
                </form>
              </>
            ) : (
              <div className="reader-saved">
                <div className="reader-saved-heading"><div><strong>Saved highlights</strong><p>Passages you've saved from this reviewer.</p></div>
                  {highlights.length > 0 && <button type="button" disabled={explaining || savingHighlight} onClick={clearAllHighlights}>Clear all</button>}
                </div>
                {highlights.length === 0 ? <p className="reader-saved-empty">Select text in the document and choose “Highlight” to save it here.</p> : (
                  <ul>{highlights.map(h => <li key={h.id}>
                    <button type="button" className="reader-highlight" disabled={sendingFollowUp || explaining} onClick={() => {
                      setCurrentExplanation({ text: h.selected_text, explanation: h.explanation || '', model: h.ai_model || '' })
                      setMessages(h.explanation ? [{ role: 'user', content: `Explain this passage:\n\n${h.selected_text}` }, { role: 'assistant', content: h.explanation }] : [])
                      setPanelTab('chat')
                    }}>
                      <span className="reader-highlight-text">{formatStudyText(h.selected_text)}</span>
                      <span className="reader-highlight-meta">{h.explanation ? 'View explanation' : 'Ask about this passage'} <Icon name="arrow-right" size={12} /></span>
                    </button>
                  </li>)}</ul>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Floating explain/highlight bubble */}
      {bubble && (
        <HighlightBubble
          text={bubble.text}
          busy={savingHighlight || explaining || sendingFollowUp}
          onExplain={handleExplain}
          onHighlight={handleHighlight}
          onClose={() => setBubble(null)}
          style={{ left: bubble.x, top: bubble.y }}
        />
      )}
    </div>
  )
}
