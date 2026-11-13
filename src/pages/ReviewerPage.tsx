import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { aiConfigured, generateFlashcardsFromFile, generatePracticeItemsFromFile, extractTextFromFile, type MaterialSource } from '@/lib/ai'
import { removeReviewFile, uploadReviewFile, assertReviewFile } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { Flashcard, PracticeType, ReviewMaterial } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, Input, Select, EmptyState, Skeleton, useToast, Modal } from '@/components/ui'

function fileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return 'file-text'
  if (mimeType.includes('pdf')) return 'file-pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-text'
  return 'file-text'
}

function fileIconColor(mimeType: string | null | undefined) {
  if (!mimeType) return 'var(--muted)'
  if (mimeType.includes('pdf')) return 'var(--danger)'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'var(--primary)'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'var(--warning)'
  return 'var(--muted)'
}

export default function ReviewerPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const program = profile ? getProgram(profile.board_program) : null
  const [materials, setMaterials] = useState<ReviewMaterial[]>([])
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileReady, setFileReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<string>('')
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null)
  const { addToast } = useToast()

  useEffect(() => { if (program) setSubject(program.subjects[0]) }, [program])
  useEffect(() => { if (profile) loadMaterials() }, [profile?.id])

  async function loadMaterials() {
    if (!profile) return
    const { data } = await supabase.from('review_materials').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    const list = (data as ReviewMaterial[]) || []
    setMaterials(list)
    if (list.length && !selectedMaterial) setSelectedMaterial(list[0].id)
    const { data: fc } = await supabase.from('flashcards').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30)
    setFlashcards((fc as Flashcard[]) || [])
  }

  function sourceForMaterial(mat: ReviewMaterial): MaterialSource {
    if (mat.extracted_text?.trim()) return { documentText: mat.extracted_text }
    if (!mat.file_uri) throw new Error('Select a saved material with an uploaded file.')
    if (mat.file_uri.startsWith('data:')) {
      const comma = mat.file_uri.indexOf(',')
      return { inlineData: mat.file_uri.slice(comma + 1), mimeType: mat.mime_type || 'application/pdf' }
    }
    return { storagePath: mat.file_uri, mimeType: mat.mime_type || 'application/pdf' }
  }

  async function handleUpload() {
    if (!file) return
    setErr(null); setMsg(null)
    try {
      assertReviewFile(file)
      setFileReady(true)
      setMsg(`File ready (${(file.size / 1024 / 1024).toFixed(2)} MB). Save to upload it.`)
    } catch (e: any) {
      setFileReady(false)
      setErr(e.message)
    }
  }

  async function saveMaterial() {
    if (!profile || !user || !program || !file) return
    if (!title || !subject) { setErr('Title and subject are required.'); return }
    setErr(null); setMsg(null)
    let storagePath = ''
    try {
      assertReviewFile(file)
      setBusy('Uploading file...')
      storagePath = await uploadReviewFile(user.id, file)
      let extractedText = ''
      let extractError: string | null = null
      if (aiConfigured()) {
        setBusy('Extracting text from document...')
        try {
          extractedText = await extractTextFromFile({ storagePath, mimeType: file.type })
        } catch (e: any) {
          extractError = e.message
        }
      }

      const { data, error } = await supabase.from('review_materials').insert({
        user_id: user.id, title, board_program: profile.board_program, subject,
        source_filename: file.name,
        file_uri: storagePath,
        mime_type: file.type,
        file_size: file.size,
        extracted_text: extractedText || null
      }).select().single()
      if (error) throw error
      storagePath = ''
      setMsg(extractedText ? 'Material saved and text extracted.' : extractError ? 'Material saved. Text extraction failed, so generation will read the stored file.' : aiConfigured() ? 'Material saved, but no text was extracted. Generation can use the stored file.' : 'Material saved. Configure AI to extract text and generate study items.')
      if (extractError) setErr(extractError)
      addToast({ type: 'success', title: 'Material saved', message: title })
      setTitle(''); setFile(null); setFileReady(false)
      await loadMaterials()
      if (data) setSelectedMaterial((data as ReviewMaterial).id)
    } catch (e: any) {
      if (storagePath) await removeReviewFile(storagePath)
      setErr(e.message)
    } finally { setBusy(null) }
  }

  async function generate(type: 'flashcards' | PracticeType) {
    if (!profile || !user || !program) return
    const mat = materials.find(m => m.id === selectedMaterial)
    if (!mat || (!mat.file_uri && !mat.extracted_text)) { setErr('Select a saved material with an uploaded file.'); return }
    if (!aiConfigured()) { setErr('AI is not configured. Set VITE_GEMINI_API_KEY in your environment.'); return }
    setErr(null); setMsg(null); setBusy(`Generating ${type}...`)
    try {
      const source = sourceForMaterial(mat)
      if (type === 'flashcards') {
        const cards = await generateFlashcardsFromFile({
          ...source,
          subject: mat.subject,
          program: profile.board_program,
          count: 10
        })
        if (cards.length) {
          const rows = cards.map(c => ({ user_id: user.id, material_id: mat.id, board_program: profile.board_program, subject: mat.subject, front: c.front, back: c.back }))
          const { error } = await supabase.from('flashcards').insert(rows)
          if (error) throw error
        }
        addToast({ type: 'success', title: 'Flashcards generated', message: `${cards.length} flashcards for ${mat.subject}` })
        setMsg(`Generated ${cards.length} flashcards for ${mat.subject}.`)
        navigate(`/practice?mode=flashcards&subject=${encodeURIComponent(mat.subject)}`)
      } else {
        const items = await generatePracticeItemsFromFile({
          ...source,
          subject: mat.subject,
          program: profile.board_program,
          type,
          count: 5
        })
        if (items.length) {
          const rows = items.map(it => ({ user_id: user.id, material_id: mat.id, board_program: profile.board_program, subject: mat.subject, type, question: it.question, answer: it.answer, rationale: it.rationale }))
          const { error } = await supabase.from('practice_items').insert(rows)
          if (error) throw error
        }
        addToast({ type: 'success', title: `${type.toUpperCase()} generated`, message: `${items.length} ${type} items for ${mat.subject}` })
        setMsg(`Generated ${items.length} ${type} items for ${mat.subject}.`)
      }
      await loadMaterials()
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  if (!profile || !program) return null

  return (
    <div className="container workspace-page">
      <WorkspacePageHeader
        eyebrow="YOUR STUDY LIBRARY" index="02" title={<>Your <em>reviewers.</em></>}
        description="Give your notes a new life. Upload a reviewer to create flashcards and practice drills for your board subjects."
        action={!aiConfigured() && <Badge variant="warning" size="md"><Icon name="alert-triangle" size={12} /> AI not configured</Badge>}
      />

      {err && (
        <div role="alert" style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>{err}</span>
        </div>
      )}

      {msg && (
        <div role="status" style={{ marginBottom: 16, padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="check-circle" size={20} />
          <span>{msg}</span>
        </div>
      )}

      {busy && (
        <Card variant="outlined" style={{ marginBottom: 16 }}>
          <CardContent style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="loader" size={20} className="spin" style={{ color: 'var(--primary)' }} />
            <span>{busy}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Upload Section */}
        <Card variant="elevated">
          <CardHeader title="Upload Reviewer" icon="file-text" subtitle="PDF, DOCX, PPT/PPTX — processed by Gemini" />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Crim Law Handout - Revised Penal Code"
                leftIcon="file-text"
                fullWidth
              />

              <Select
                label="Board Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                options={program.subjects.map(s => ({ value: s, label: s }))}
                leftIcon="book-open"
                fullWidth
              />

              <div>
                <label htmlFor="review-file-input" style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>FILE</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="review-file-input"
                    type="file"
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    onChange={e => { setFile(e.target.files?.[0] || null); setFileReady(false) }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                  />
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px',
                    borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--panel-2)',
                    transition: 'all 150ms ease'
                  }}>
                    <Icon name={fileIcon(file?.type)} size={28} style={{ color: fileIconColor(file?.type), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: file ? 'var(--text)' : 'var(--muted)' }}>
                        {file ? file.name : 'Drag & drop a file or click to browse'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-strong)' }}>Max 10MB • PDF, DOCX, PPT/PPTX supported</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="lg" leftIcon="upload" onClick={handleUpload} disabled={!file || !!busy} fullWidth style={{ maxWidth: 200 }}>
                  {fileReady ? 'File ready' : 'Check file'}
                </Button>
                <Button variant="primary" size="lg" leftIcon="save" onClick={saveMaterial} disabled={!!busy || !title || !file} fullWidth style={{ maxWidth: 200 }}>
                  Save Material
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generate Section */}
        <Card variant="elevated">
          <CardHeader title="Generate from Saved Material" icon="brain" subtitle={`Generates items tagged by the material's board subject and aligned to ${program.name}`} />
          <CardContent>
            <Select
              label="Material"
              value={selectedMaterial}
              onChange={e => setSelectedMaterial(e.target.value)}
              options={[{ value: '', label: 'Select material...' }, ...materials.map(m => ({ value: m.id, label: `${m.title} — ${m.subject}` }))]}
              leftIcon="book-open"
              fullWidth
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant="primary" size="lg" leftIcon="book-open" onClick={() => generate('flashcards')} disabled={!!busy || !selectedMaterial} fullWidth>
                Generate Flashcards
              </Button>
              <Button variant="secondary" size="lg" leftIcon="file-text" onClick={() => generate('mcq')} disabled={!!busy || !selectedMaterial} fullWidth>
                Generate PRC-Style Situational MCQs
              </Button>
              <Button variant="secondary" size="lg" leftIcon="brain" onClick={() => generate('diagnosis')} disabled={!!busy || !selectedMaterial} fullWidth>
                Generate Case & Concept Diagnosis
              </Button>
              <Button variant="secondary" size="lg" leftIcon="chevron-up-down" onClick={() => generate('sequence')} disabled={!!busy || !selectedMaterial} fullWidth>
                Generate Priority & Sequence Ordering
              </Button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Recent Flashcards</h4>
              {flashcards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  <Icon name="book-open" size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p>No flashcards yet. Generate some from your materials above.</p>
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flashcards.slice(0, 8).map(f => (
                    <li key={f.id}>
                      <button type="button" className="reviewer-flashcard" onClick={() => { setSelectedCard(f); setSelectedMaterial('') }}>
                        <Badge variant="primary" size="sm">{f.subject}</Badge>
                        <span>{f.front}</span>
                        <Icon name="arrow-up-right" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flashcard Detail Modal */}
      {selectedCard && (
        <Modal open={!!selectedCard} onClose={() => setSelectedCard(null)} title="Flashcard" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Prompt</div>
              <div style={{ fontSize: 16, lineHeight: 1.6 }}>{selectedCard.front}</div>
            </div>
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Answer</div>
              <div style={{ fontSize: 16, lineHeight: 1.6 }}>{selectedCard.back}</div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              <Badge variant="primary" size="sm" style={{ marginRight: 8 }}>{selectedCard.subject}</Badge>
              Generated from: {selectedCard.material_id ? 'Saved material' : 'AI generation'}
            </p>
          </div>
          <div className="ui-card-footer">
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <Button variant="secondary" onClick={() => setSelectedCard(null)} style={{ flex: 1 }}>
                Close
              </Button>
              <Button variant="primary" onClick={() => { setSelectedCard(null); navigate(`/practice?mode=flashcards&subject=${encodeURIComponent(selectedCard.subject)}`) }} style={{ flex: 1 }}>
                Practice this subject
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Saved Materials Table */}
      <Card variant="outlined">
        <CardHeader title="Saved Review Materials" icon="file-text" subtitle={`${materials.length} material${materials.length !== 1 ? 's' : ''} saved`} />
        <CardContent>
          {materials.length === 0 ? (
            <EmptyState
              icon="file-text"
              title="No materials saved yet"
              description="Upload a reviewer above to get started."
            />
          ) : (
            <div className="table-wrapper" role="region" aria-label="Saved review materials, scrollable table" tabIndex={0} style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th style={{width: 180}}>Subject</th>
                    <th style={{width: 160}}>Source</th>
                    <th style={{width: 120}}>Type</th>
                    <th style={{width: 100}}>Size</th>
                    <th style={{width: 140}}>Action</th>
                    <th style={{width: 180}}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>{m.title}</td>
                      <td><Badge variant="primary" size="sm">{m.subject}</Badge></td>
                      <td className="muted" style={{ fontSize: 13 }}>{m.source_filename || '—'}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{m.mime_type || '—'}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{m.file_size ? `${(m.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}</td>
                      <td>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/side-by-side/${m.id}`)} fullWidth leftIcon="file-text">
                          Open Reader
                        </Button>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
