import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { extractTextFromPdf } from '@/lib/pdf'
import { aiConfigured, generateFlashcards, generatePracticeItems } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import type { Flashcard, PracticeType, ReviewMaterial } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, Input, Select, Textarea, Badge as BadgeComp, EmptyState, Skeleton, useToast } from '@/components/ui'

export default function ReviewerPage() {
  const { profile, user } = useAuth()
  const program = profile ? getProgram(profile.board_program) : null
  const [materials, setMaterials] = useState<ReviewMaterial[]>([])
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<string>('')
  const { addToast } = useToast()

  useEffect(() => { if (program) setSubject(program.subjects[0]) }, [program])
  useEffect(() => { if (profile) loadMaterials() }, [profile])

  async function loadMaterials() {
    if (!profile) return
    const { data } = await supabase.from('review_materials').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    const list = (data as ReviewMaterial[]) || []
    setMaterials(list)
    if (list.length && !selectedMaterial) setSelectedMaterial(list[0].id)
    const { data: fc } = await supabase.from('flashcards').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30)
    setFlashcards((fc as Flashcard[]) || [])
  }

  async function handleExtract() {
    if (!file) return
    setErr(null); setMsg(null); setBusy('Extracting text from PDF...')
    try {
      const text = await extractTextFromPdf(file)
      setExtracted(text)
      setMsg(text ? `Extracted ${text.length} characters.` : 'No text extracted (scanned PDFs may not yield text).')
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  async function saveMaterial() {
    if (!profile || !user || !program) return
    if (!title || !subject) { setErr('Title and subject are required.'); return }
    setErr(null); setMsg(null); setBusy('Saving material...')
    try {
      const { data, error } = await supabase.from('review_materials').insert({
        user_id: user.id, title, board_program: profile.board_program, subject,
        source_filename: file?.name || null, extracted_text: extracted || null
      }).select().single()
      if (error) throw error
      setMsg('Reviewer material saved.')
      addToast({ type: 'success', title: 'Material saved', message: title })
      setTitle(''); setFile(null); setExtracted('')
      await loadMaterials()
      if (data) setSelectedMaterial((data as any).id)
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  async function generate(type: 'flashcards' | PracticeType) {
    if (!profile || !user || !program) return
    const mat = materials.find(m => m.id === selectedMaterial)
    if (!mat || !mat.extracted_text) { setErr('Select a saved material with extracted text.'); return }
    if (!aiConfigured()) { setErr('AI is not configured. Set VITE_OPENAI_API_KEY in .env.'); return }
    setErr(null); setMsg(null); setBusy(`Generating ${type}...`)
    try {
      if (type === 'flashcards') {
        const cards = await generateFlashcards({ text: mat.extracted_text, subject: mat.subject, program: profile.board_program, count: 10 })
        if (cards.length) {
          const rows = cards.map(c => ({ user_id: user.id, material_id: mat.id, board_program: profile.board_program, subject: mat.subject, front: c.front, back: c.back }))
          const { error } = await supabase.from('flashcards').insert(rows)
          if (error) throw error
        }
        addToast({ type: 'success', title: 'Flashcards generated', message: `${cards.length} flashcards for ${mat.subject}` })
        setMsg(`Generated ${cards.length} flashcards for ${mat.subject}.`)
      } else {
        const items = await generatePracticeItems({ text: mat.extracted_text, subject: mat.subject, program: profile.board_program, type, count: 5 })
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
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700 }}>Reviewer-to-Flashcard & Drill Generator</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>Upload review handouts or subject PDFs. AI converts them into active-recall flashcards and situational drills tagged by board subject.</p>
        </div>
        {!aiConfigured() && (
          <Badge variant="warning" size="md">
            <Icon name="alert-triangle" size={12} />
            AI not configured
          </Badge>
        )}
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="alert-circle" size={20} />
          <span>{err}</span>
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <CardHeader title="Upload Reviewer (PDF)" icon="file-pdf" subtitle="Extract text from your review materials" />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Crim Law Handout - Revised Penal Code"
                leftIcon="file-text"
              />

              <Select
                label="Board Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                options={program.subjects.map(s => ({ value: s, label: s }))}
                leftIcon="book-open"
              />

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>PDF FILE</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                  />
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px',
                    borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--panel-2)',
                    transition: 'all 150ms ease'
                  }}>
                    <Icon name="file-pdf" size={28} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: file ? 'var(--text)' : 'var(--muted)' }}>
                        {file ? file.name : 'Drag & drop a PDF file or click to browse'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-strong)' }}>Max 10MB • Text extraction works best with digital PDFs</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="lg" leftIcon="download" onClick={handleExtract} disabled={!file || !!busy} fullWidth style={{ maxWidth: 200 }}>
                  Extract Text
                </Button>
                <Button variant="primary" size="lg" leftIcon="save" onClick={saveMaterial} disabled={!!busy || !title} fullWidth style={{ maxWidth: 200 }}>
                  Save Material
                </Button>
              </div>

              {extracted && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>EXTRACTED TEXT (PREVIEW/EDIT)</label>
                  <Textarea
                    value={extracted}
                    onChange={e => setExtracted(e.target.value)}
                    rows={10}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                </div>
              )}
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
                  <Icon name="book-open" size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p>No flashcards yet. Generate some from your materials above.</p>
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flashcards.slice(0, 8).map(f => (
                    <li key={f.id} style={{ padding: 12, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Badge variant="primary" size="sm" style={{ flexShrink: 0 }}>{f.subject}</Badge>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{f.front}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved Materials Table */}
      <Card variant="outlined">
        <CardHeader title="Saved Review Materials" icon="file-text" subtitle={`${materials.length} material${materials.length !== 1 ? 's' : ''} saved`} />
        <CardContent>
          {materials.length === 0 ? (
            <EmptyState
              icon="file-text"
              title="No materials saved yet"
              description="Upload a PDF reviewer above to get started."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th style={{width: 180}}>Subject</th>
                    <th style={{width: 160}}>Source</th>
                    <th style={{width: 120}}>Text Length</th>
                    <th style={{width: 180}}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>{m.title}</td>
                      <td><Badge variant="primary" size="sm">{m.subject}</Badge></td>
                      <td className="muted" style={{ fontSize: 13 }}>{m.source_filename || '—'}</td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {m.extracted_text ? `${Math.round(m.extracted_text.length / 100) / 10}k chars` : '—'}
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