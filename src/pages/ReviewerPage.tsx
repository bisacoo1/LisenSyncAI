import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { extractTextFromPdf } from '@/lib/pdf'
import { aiConfigured, generateFlashcards, generatePracticeItems } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import type { Flashcard, PracticeType, ReviewMaterial } from '@/types'

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
        setMsg(`Generated ${cards.length} flashcards for ${mat.subject}.`)
      } else {
        const items = await generatePracticeItems({ text: mat.extracted_text, subject: mat.subject, program: profile.board_program, type, count: 5 })
        if (items.length) {
          const rows = items.map(it => ({ user_id: user.id, material_id: mat.id, board_program: profile.board_program, subject: mat.subject, type, question: it.question, answer: it.answer, rationale: it.rationale }))
          const { error } = await supabase.from('practice_items').insert(rows)
          if (error) throw error
        }
        setMsg(`Generated ${items.length} ${type} items for ${mat.subject}.`)
      }
      await loadMaterials()
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  if (!profile || !program) return null
  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="section-title">Reviewer-to-Flashcard & Drill Generator</h1>
          <p className="muted">Upload review handouts or subject PDFs. AI converts them into active-recall flashcards and situational drills tagged by board subject.</p>
        </div>
        {!aiConfigured() && <span className="badge warn">AI not configured</span>}
      </div>

      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
      {busy && <div className="card" style={{ marginBottom: 12 }}>⏳ {busy}</div>}

      <div className="grid grid-2">
        <div className="card">
          <h3>Upload Reviewer (PDF)</h3>
          <div className="field"><label>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Crim Law Handout - Revised Penal Code" /></div>
          <div className="field">
            <label>Board Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {program.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>PDF file</label><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={handleExtract} disabled={!file || !!busy}>Extract Text</button>
            <button className="btn" onClick={saveMaterial} disabled={!!busy || !title}>Save Material</button>
          </div>
          {extracted && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Extracted text (preview/edit)</label>
              <textarea rows={10} value={extracted} onChange={e => setExtracted(e.target.value)} />
            </div>
          )}
        </div>

        <div className="card">
          <h3>Generate from Saved Material</h3>
          <div className="field">
            <label>Material</label>
            <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)}>
              <option value="">Select material...</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.title} — {m.subject}</option>)}
            </select>
          </div>
          <p className="muted">Generates items tagged by the material's board subject and aligned to {program.name}.</p>
          <div className="grid">
            <button className="btn" onClick={() => generate('flashcards')} disabled={!!busy || !selectedMaterial}>Generate Flashcards</button>
            <button className="btn secondary" onClick={() => generate('mcq')} disabled={!!busy || !selectedMaterial}>Generate PRC-Style Situational MCQs</button>
            <button className="btn secondary" onClick={() => generate('diagnosis')} disabled={!!busy || !selectedMaterial}>Generate Case & Concept Diagnosis</button>
            <button className="btn secondary" onClick={() => generate('sequence')} disabled={!!busy || !selectedMaterial}>Generate Priority & Sequence Ordering</button>
          </div>
          <hr />
          <h4>Recent Flashcards</h4>
          {flashcards.length === 0 ? <p className="muted">No flashcards yet.</p> : (
            <ul className="list">
              {flashcards.slice(0, 8).map(f => <li key={f.id}><strong>[{f.subject}]</strong> {f.front}</li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Saved Review Materials</h3>
        {materials.length === 0 ? <p className="muted">No materials saved yet.</p> : (
          <table className="table">
            <thead><tr><th>Title</th><th>Subject</th><th>Source</th><th>Text</th><th>Created</th></tr></thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td>{m.title}</td>
                  <td>{m.subject}</td>
                  <td className="muted">{m.source_filename || '—'}</td>
                  <td>{m.extracted_text ? `${Math.round(m.extracted_text.length / 100) / 10}k chars` : '—'}</td>
                  <td className="muted">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
