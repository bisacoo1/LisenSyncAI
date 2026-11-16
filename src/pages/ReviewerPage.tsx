import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { aiConfigured, generateFlashcardsFromFile, generatePracticeItemsFromFile, extractTextFromFile, type MaterialSource } from '@/lib/ai'
import { removeReviewFile, uploadReviewFile, assertReviewFile } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { Flashcard, PracticeType, ReviewMaterial, UserSubject } from '@/types'
import { Card, CardHeader, CardContent, Button, Badge, Icon, Input, Select, EmptyState, Skeleton, useToast, Modal } from '@/components/ui'

type GeneratedStudySet = 'flashcards' | Exclude<PracticeType, 'flashcard_drill'>
const DEFAULT_COURSE_SUBJECT = 'General'
const COURSE_STUDY_SETS: { type: GeneratedStudySet; label: string }[] = [
  { type: 'flashcards', label: 'flashcards' },
  { type: 'mcq', label: 'multiple choice questions' },
  { type: 'enumeration', label: 'enumeration questions' },
  { type: 'identification', label: 'identification questions' },
]

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  if (typeof error === 'string' && error) return error
  return 'An unexpected error occurred.'
}

function flashcardPracticePath(card: Flashcard) {
  const path = `/practice?mode=flashcards&subject=${encodeURIComponent(card.subject)}`
  return card.material_id ? `${path}&material=${encodeURIComponent(card.material_id)}` : path
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
  const [generationType, setGenerationType] = useState<GeneratedStudySet>('flashcards')
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null)
  const uploadCardRef = useRef<HTMLDivElement>(null)
  const generateCardRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  /* Saved materials discoverability */
  const [searchQuery, setSearchQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [materialsLoading, setMaterialsLoading] = useState(true)
  const { addToast } = useToast()
  const isCourse = profile?.track === 'course'
  const [customSubjects, setCustomSubjects] = useState<UserSubject[]>([])

  useEffect(() => {
    if (isCourse) setSubject(DEFAULT_COURSE_SUBJECT)
    else if (program) setSubject(program.subjects[0])
  }, [program, isCourse])
  useEffect(() => { if (profile) loadMaterials() }, [profile?.id])
  useEffect(() => {
    const requestedMaterial = searchParams.get('material')
    if (requestedMaterial) setSelectedMaterial(requestedMaterial)
  }, [searchParams])

  /* Scroll the requested reviewer function into view when arriving from the sidebar Upload section */
  useEffect(() => {
    const tab = searchParams.get('tab')
    const target = tab === 'upload'
      ? uploadCardRef.current
      : tab === 'generate'
        ? (isCourse ? uploadCardRef.current : generateCardRef.current)
        : null
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const subjectOptions = useMemo(() => {
    if (!isCourse) return program?.subjects || []
    const names = new Set(customSubjects.map(s => s.name))
    materials.forEach(m => names.add(m.subject))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [isCourse, customSubjects, materials, program])
  const generationOptions = isCourse
    ? [
        { value: 'flashcards', label: 'Flashcards' },
        { value: 'mcq', label: 'Multiple choice' },
        { value: 'enumeration', label: 'Enumeration' },
        { value: 'identification', label: 'Identification' },
      ]
    : [
        { value: 'flashcards', label: 'Flashcards' },
        { value: 'mcq', label: 'PhLE situational MCQs' },
        { value: 'diagnosis', label: 'Clinical & concept diagnosis' },
        { value: 'sequence', label: 'Priority & sequence ordering' },
      ]

  async function loadMaterials() {
    if (!profile) return
    setMaterialsLoading(true)
    const { data } = await supabase.from('review_materials').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    const list = (data as ReviewMaterial[]) || []
    setMaterials(list)
    if (list.length && !selectedMaterial) setSelectedMaterial(searchParams.get('material') || list[0].id)
    const { data: fc } = await supabase.from('flashcards').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30)
    setFlashcards((fc as Flashcard[]) || [])
    if (isCourse) {
      const { data: subs } = await supabase.from('user_subjects').select('*').eq('user_id', profile.id).order('name')
      const subList = (subs as UserSubject[]) || []
      setCustomSubjects(subList)
    }
    setMaterialsLoading(false)
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
    const materialSubject = isCourse ? DEFAULT_COURSE_SUBJECT : subject
    if (!title || !materialSubject) { setErr('Title and subject are required.'); return }
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
        user_id: user.id, title, board_program: program.key, subject: materialSubject,
        source_filename: file.name,
        file_uri: storagePath,
        mime_type: file.type,
        file_size: file.size,
        extracted_text: extractedText || null
      }).select('*').single()
      if (error) throw error
      const savedMaterial = data as ReviewMaterial
      if (isCourse && materialSubject.trim()) {
        await supabase.from('user_subjects').upsert(
          { user_id: user.id, name: materialSubject },
          { onConflict: 'user_id,name', ignoreDuplicates: true }
        )
        setCustomSubjects(prev => prev.some(s => s.name === materialSubject) ? prev : [...prev, { id: '', user_id: user.id, name: materialSubject } as UserSubject])
      }
      storagePath = ''
      setTitle(''); setFile(null); setFileReady(false)

      if (isCourse) {
        if (!aiConfigured()) {
          setMsg('Reviewer saved under General.')
          setErr('Automatic generation did not run. Configure VITE_GEMINI_API_KEY, then upload the reviewer again.')
          addToast({ type: 'error', title: 'AI is not configured', message: 'The reviewer was saved, but study sets were not generated.' })
        } else {
          const generated: string[] = []
          const failures: string[] = []

          for (const studySet of COURSE_STUDY_SETS) {
            setBusy(`Generating ${studySet.label}...`)
            try {
              const count = await generateStudySet(studySet.type, savedMaterial)
              generated.push(`${count} ${studySet.label}`)
            } catch (generationError) {
              failures.push(`${studySet.label}: ${getErrorMessage(generationError)}`)
            }
          }

          if (failures.length) {
            setMsg(`Reviewer saved. Generated ${generated.join(', ') || 'no study sets'}.`)
            setErr(`Some study sets could not be generated: ${failures.join(' | ')}`)
            addToast({ type: 'error', title: 'Some study sets were not generated', message: failures.join('; ') })
          } else {
            const extractionNote = extractError ? ' Text extraction failed, so generation used the saved file.' : ''
            setMsg(`Reviewer saved. Automatically generated ${generated.join(', ')}.${extractionNote}`)
            addToast({ type: 'success', title: 'Study sets ready', message: `${title}: flashcards, multiple choice, enumeration, and identification.` })
          }
        }
      } else {
        setMsg(extractedText ? 'Material saved and text extracted.' : extractError ? 'Material saved. Text extraction failed, so generation will read the stored file.' : aiConfigured() ? 'Material saved, but no text was extracted. Generation can use the stored file.' : 'Material saved. Configure AI to extract text and generate study items.')
        if (extractError) setErr(extractError)
        addToast({ type: 'success', title: 'Material saved', message: title })
      }

      await loadMaterials()
    } catch (e: any) {
      if (storagePath) await removeReviewFile(storagePath)
      setErr(getErrorMessage(e))
    } finally { setBusy(null) }
  }

  async function generateStudySet(type: 'flashcards' | PracticeType, mat: ReviewMaterial): Promise<number> {
    if (!profile || !user || !program) throw new Error('Your study profile is not ready.')
    if (!mat || (!mat.file_uri && !mat.extracted_text)) throw new Error('This material has no uploaded file or extracted text.')
    if (!aiConfigured()) throw new Error('AI is not configured. Set VITE_GEMINI_API_KEY in your environment.')

    const source = sourceForMaterial(mat)
    if (type === 'flashcards') {
      const cards = await generateFlashcardsFromFile({
        ...source,
        subject: mat.subject,
        program: program.key,
        track: profile.track || 'board',
        count: 10
      })
      if (cards.length) {
        const rows = cards.map(c => ({ user_id: user.id, material_id: mat.id, board_program: program.key, subject: mat.subject, front: c.front, back: c.back }))
        const { error } = await supabase.from('flashcards').insert(rows)
        if (error) throw error
      }
      return cards.length
    }

    const items = await generatePracticeItemsFromFile({
      ...source,
      subject: mat.subject,
      program: program.key,
      track: profile.track || 'board',
      type,
      count: 5
    })
    if (items.length) {
      const rows = items.map(it => ({ user_id: user.id, material_id: mat.id, board_program: program.key, subject: mat.subject, type, question: it.question, answer: it.answer, rationale: it.rationale }))
      const { error } = await supabase.from('practice_items').insert(rows)
      if (error) throw error
    }
    return items.length
  }

  async function generate(type: 'flashcards' | PracticeType, mat: ReviewMaterial) {
    if (!profile || !user || !program) return
    setErr(null); setMsg(null); setBusy(`Generating ${type}...`)
    try {
      const count = await generateStudySet(type, mat)
      if (type === 'flashcards') {
        addToast({ type: 'success', title: 'Flashcards generated', message: `${count} flashcards for ${mat.subject}` })
        setMsg(`Generated ${count} flashcards for ${mat.subject}.`)
        navigate(`/practice?mode=flashcards&subject=${encodeURIComponent(mat.subject)}&material=${encodeURIComponent(mat.id)}`)
      } else {
        addToast({ type: 'success', title: `${type.toUpperCase()} generated`, message: `${count} ${type} items for ${mat.subject}` })
        setMsg(`Generated ${count} ${type} items for ${mat.subject}.`)
      }
      await loadMaterials()
    } catch (e) { setErr(getErrorMessage(e)) } finally { setBusy(null) }
  }

  /* Materials with search / subject filter / sort applied */
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.toLowerCase()
    let list = materials.filter(m =>
      (!subjectFilter || m.subject === subjectFilter) &&
      (!q || m.title.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || (m.source_filename || '').toLowerCase().includes(q))
    )
    list = [...list].sort((a, b) => {
      if (sortOrder === 'title') return a.title.localeCompare(b.title)
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [materials, searchQuery, subjectFilter, sortOrder])
  const selectedMaterialRecord = filteredMaterials.find(material => material.id === selectedMaterial)

  if (!profile || !program) return null

  return (
    <div className="container workspace-page">
      <WorkspacePageHeader
        eyebrow={isCourse ? 'STUDY LIBRARY' : 'PHARMACY STUDY LIBRARY'} index="02" title={<>Your <em>{isCourse ? 'reviewers' : 'Pharmacy reviewers'}.</em></>}
        description={isCourse
          ? 'Upload your course notes once. Saving a reviewer automatically creates flashcards, multiple choice, enumeration, and identification practice.'
          : 'Give your BS Pharmacy notes a new life. Upload lecture decks, drug monographs, or review handouts to create PhLE flashcards and clinical drills.'}
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

      {/* Upload section: course study sets generate automatically after the material is saved. */}
      <section className="upload-section reviewer-upload-section" style={{ marginBottom: 24 }}>
        <div className="upload-section-header reviewer-upload-heading" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Icon name="upload" size={20} style={{ color: 'var(--primary)' }} />
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-strong)' }}>Upload section</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              {isCourse ? 'Upload and auto-create study sets' : 'Add & generate review materials'}
            </h3>
          </div>
        </div>
        <div className="grid grid-2">
          {/* Upload Reviewer */}
          <Card variant="elevated" className="reviewer-upload-card" ref={uploadCardRef}>
          <CardHeader
            title="Upload Reviewer"
            icon="file-text"
            subtitle={isCourse
              ? 'PDF, DOCX, PPT/PPTX — save once to automatically generate four study sets.'
              : 'PDF, DOCX, PPT/PPTX — processed by Gemini'}
          />
          <CardContent className="reviewer-upload-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Pharmacology Handout - Autonomic Nervous System Drugs"
                leftIcon="file-text"
                fullWidth
              />

              {isCourse ? (
                <p style={{ margin: '-4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  Course reviewers are automatically grouped under <strong>{DEFAULT_COURSE_SUBJECT}</strong>.
                </p>
              ) : (
                <Select
                  label="PhLE Module / Subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  options={program.subjectDetails.map(m => ({ value: m.name, label: `${m.moduleCode} — ${m.name} (${m.weightPercent}%)` }))}
                  leftIcon="pill"
                  fullWidth
                />
              )}

              <div className="reviewer-upload-field">
                <label htmlFor="review-file-input" className="reviewer-upload-label">REVIEWER FILE</label>
                <div className="reviewer-upload-dropzone">
                  <input
                    id="review-file-input"
                    type="file"
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    onChange={e => { setFile(e.target.files?.[0] || null); setFileReady(false) }}
                    className="reviewer-upload-input"
                    aria-label="Choose reviewer file"
                  />
                  <span className="reviewer-upload-icon" aria-hidden="true">
                    <Icon name={fileIcon(file?.type)} size={25} style={{ color: fileIconColor(file?.type) }} />
                  </span>
                  <div className="reviewer-upload-copy">
                    <div className="reviewer-upload-title">
                      {file ? file.name : 'Choose a document to upload'}
                    </div>
                    <div className="reviewer-upload-hint">
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${fileReady ? 'File checked' : 'Selected'}`
                        : 'Up to 10 MB · PDF, DOCX, PPT or PPTX'}
                    </div>
                  </div>
                  <span className="reviewer-upload-action">Browse files</span>
                </div>
              </div>

              <div className="reviewer-upload-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="secondary" size="lg" leftIcon="upload" onClick={handleUpload} disabled={!file || !!busy} fullWidth style={{ maxWidth: 200 }}>
                  {fileReady ? 'File ready' : 'Check file'}
                </Button>
                <Button variant="primary" size="lg" leftIcon="save" onClick={saveMaterial} disabled={!!busy || !title || !file} fullWidth style={{ maxWidth: 240 }}>
                  {isCourse && aiConfigured() ? 'Save & generate study sets' : 'Save Material'}
                </Button>
              </div>

              {!isCourse && (
              <div ref={generateCardRef} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GENERATE FROM A SAVED MATERIAL</span>
                  <Select
                    label="Material"
                    value={selectedMaterial}
                    onChange={e => setSelectedMaterial(e.target.value)}
                    options={[{ value: '', label: 'Select material...' }, ...filteredMaterials.map(m => ({ value: m.id, label: `${m.title} — ${m.subject}` }))]}
                    leftIcon="book-open"
                    fullWidth
                    hint={materials.length ? 'Choose a saved reviewer and a study format.' : 'Save a reviewer above before generating a study set.'}
                  />
                </div>
                <Select
                  label="Study set type"
                  value={generationType}
                  onChange={e => setGenerationType(e.target.value as GeneratedStudySet)}
                  options={generationOptions}
                  leftIcon="book-open-text"
                  fullWidth
                />
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon="sparkles"
                  onClick={() => selectedMaterialRecord && generate(generationType, selectedMaterialRecord)}
                  disabled={!!busy || !selectedMaterialRecord}
                  fullWidth
                >
                  Generate study set
                </Button>
              </div>
              )}
            </div>
          </CardContent>
        </Card>

        </div>
      </section>

      {/* Dedicated Recent Flashcards section */}
      <Card variant="elevated">
        <CardHeader
          title="Recent Flashcards"
          icon="book-open"
          subtitle={`Your ${flashcards.length} most recently generated cards. Open a card to view its prompt and answer, or practice the full set.`}
          action={flashcards.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon="book-open"
              onClick={() => navigate(flashcardPracticePath(flashcards[0]))}
            >
              Practice flashcards
            </Button>
          ) : null}
        />
        <CardContent>
          {flashcards.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="No flashcards yet"
              description={isCourse
                ? 'Save a course reviewer to automatically generate flashcards and practice sets.'
                : 'Generate flashcards from a saved material, then review them here.'}
              action={!isCourse && filteredMaterials[0] ? { label: 'Generate your first cards', variant: 'primary', onClick: () => { setSelectedMaterial(filteredMaterials[0].id); generateCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } } : undefined}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flashcards.slice(0, 10).map(f => (
                <button type="button" key={f.id} className="reviewer-flashcard" onClick={() => setSelectedCard(f)}>
                  <Badge variant="primary" size="sm">{f.subject}</Badge>
                  <span title={f.front}>{f.front}</span>
                  <Icon name="arrow-up-right" size={16} />
                </button>
              ))}
              {flashcards.length > 10 && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  + {flashcards.length - 10} more cards — open Flashcards practice to review the full set.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Review Materials — generation happens per material row */}
      <Card variant="outlined">
        <CardHeader
          title="Saved Review Materials"
          icon="file-text"
          subtitle={`${filteredMaterials.length} material${filteredMaterials.length !== 1 ? 's' : ''} saved`}
        />
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input
                label="Search materials"
                placeholder="Title, subject, or file name"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                leftIcon="search"
                fullWidth
                style={{ maxWidth: 420 }}
              />
              <Select
                label={isCourse ? 'Subject' : 'PhLE Module'}
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                options={isCourse
                  ? [{ value: '', label: 'All subjects' }, ...subjectOptions.map(s => ({ value: s, label: s }))]
                  : [{ value: '', label: 'All Pharmacy modules' }, ...program.subjectDetails.map(m => ({ value: m.name, label: `${m.moduleCode} — ${m.name}` }))]}
                leftIcon={isCourse ? 'book-open' : 'pill'}
                fullWidth
                style={{ maxWidth: 280 }}
              />
              <Select
                label="Sort by"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest' | 'title')}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'title', label: 'A to Z' },
                ]}
                leftIcon="sort-asc"
                fullWidth
                style={{ maxWidth: 200 }}
              />
            </div>

            {materialsLoading ? (
              <div className="table-wrapper" role="region" aria-label="Saved review materials, scrollable table" tabIndex={0} style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th style={{ width: 160 }}>Subject</th>
                      <th style={{ width: 200 }}>Source</th>
                      <th style={{ width: 100 }}>Size</th>
                      <th style={{ width: 160 }}>Created</th>
                      <th style={{ width: 200 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td><Skeleton variant="text" width={180} /></td>
                        <td><Skeleton variant="text" width={80} /></td>
                        <td><Skeleton variant="text" width={120} /></td>
                        <td><Skeleton variant="text" width={60} /></td>
                        <td><Skeleton variant="text" width={100} /></td>
                        <td><Skeleton variant="text" width={80} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <EmptyState
                icon="file-text"
                title={searchQuery || subjectFilter ? "No materials match your filters" : "No materials saved yet"}
                description={searchQuery || subjectFilter
                  ? "Try clearing the search or subject filter to see your saved reviewers."
                  : "Upload a reviewer above to get started."}
                action={{
                  label: 'Clear filters',
                  variant: 'outline',
                  onClick: () => { setSearchQuery(''); setSubjectFilter(''); setSortOrder('newest') }
                }}
              />
            ) : (
              <div className="table-wrapper" role="region" aria-label="Saved review materials, scrollable table" tabIndex={0} style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th style={{ width: 160 }}>Subject</th>
                      <th style={{ width: 200 }}>Source</th>
                      <th style={{ width: 100 }}>Size</th>
                      <th style={{ width: 160 }}>Created</th>
                      <th style={{ width: 200 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.title}</td>
                        <td><Badge variant="primary" size="sm">{m.subject}</Badge></td>
                        <td className="muted" style={{ fontSize: 13 }}>{m.source_filename || '—'}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{m.file_size ? `${(m.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{new Date(m.created_at).toLocaleString()}</td>
                        <td>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/side-by-side/${m.id}`)} leftIcon="file-text">
                            Open Reader
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              <Button variant="primary" onClick={() => { setSelectedCard(null); navigate(flashcardPracticePath(selectedCard)) }} style={{ flex: 1 }}>
                Practice this set
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
