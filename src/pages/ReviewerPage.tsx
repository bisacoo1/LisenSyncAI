import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { aiConfigured, generateFlashcardsFromFile, generatePracticeItemsFromFile, extractTextFromFile, generateMaterialTitle, type MaterialSource } from '@/lib/ai'
import { removeReviewFile, uploadReviewFile, assertReviewFile } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { PracticeType, ReviewMaterial } from '@/types'
import { Card, CardContent, Button, Badge, Icon, Select, useToast } from '@/components/ui'

type GeneratedStudySet = 'flashcards' | Exclude<PracticeType, 'flashcard_drill'>
type UploadStage = 'uploading' | 'extracting' | 'saving' | 'generating'
type UploadMode = 'file' | 'text'
const MAX_PASTED_TEXT_CHARS = 30_000
const DEFAULT_COURSE_SUBJECT = 'General'
const COURSE_STUDY_SETS: { type: GeneratedStudySet; label: string }[] = [
  { type: 'flashcards', label: 'flashcards' },
  { type: 'mcq', label: 'multiple choice questions' },
  { type: 'enumeration', label: 'enumeration questions' },
  { type: 'identification', label: 'identification questions' },
]

function fileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return 'file-text'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.includes('pdf')) return 'file-pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-text'
  return 'file-text'
}

function fileIconColor(mimeType: string | null | undefined) {
  if (!mimeType) return 'var(--muted)'
  if (mimeType.startsWith('image/')) return 'var(--primary)'
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

function filenameMaterialTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Uploaded reviewer'
}

function pastedTextMaterialTitle(text: string) {
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
  return firstLine.replace(/^[#*_-\s]+/, '').slice(0, 120) || 'Pasted study notes'
}

export default function ReviewerPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const program = profile ? getProgram(profile.board_program) : null
  const [materials, setMaterials] = useState<ReviewMaterial[]>([])
  const [subject, setSubject] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<UploadMode>('file')
  const [pastedText, setPastedText] = useState('')
  const [fileReady, setFileReady] = useState(false)
  const [uploadStage, setUploadStage] = useState<UploadStage | null>(null)
  const [generationStep, setGenerationStep] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<string>('')
  const [generationType, setGenerationType] = useState<GeneratedStudySet>('flashcards')
  const uploadCardRef = useRef<HTMLDivElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const generateCardRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const isCourse = profile?.track === 'course'
  const aiIsConfigured = aiConfigured()
  const uploadSteps: { stage: UploadStage; label: string }[] = [
    ...(uploadMode === 'file' ? [{ stage: 'uploading' as const, label: file?.type.startsWith('image/') ? 'Uploading photo' : 'Uploading file' }] : []),
    ...(aiIsConfigured ? [{ stage: 'extracting' as const, label: uploadMode === 'text' ? 'Analyzing pasted text' : 'Analyzing material' }] : []),
    { stage: 'saving', label: 'Saving reviewer' },
    ...(aiIsConfigured ? [{ stage: 'generating' as const, label: isCourse ? 'Creating study sets' : 'Generating flashcards' }] : []),
  ]
  const currentUploadStep = uploadStage
    ? uploadSteps.findIndex(step => step.stage === uploadStage)
    : -1

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
    const { data } = await supabase.from('review_materials').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    const list = (data as ReviewMaterial[]) || []
    setMaterials(list)
    if (list.length && !selectedMaterial) setSelectedMaterial(searchParams.get('material') || list[0].id)
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

  function selectUploadFile(selectedFile: File | null) {
    setErr(null); setMsg(null)
    setUploadMode('file')
    setFile(selectedFile)
    setFileReady(false)
    if (!selectedFile) return
    try {
      assertReviewFile(selectedFile)
      setFileReady(true)
      setMsg(`${selectedFile.name} is ready (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB).`)
    } catch (e: any) {
      setErr(e.message)
    }
  }

  function handleFileDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (event.dataTransfer.files[0]) selectUploadFile(event.dataTransfer.files[0])
  }

  async function saveMaterial() {
    const selectedFile = uploadMode === 'file' ? file : null
    const materialText = uploadMode === 'text' ? pastedText.trim() : ''
    if (!profile || !user || !program || (!selectedFile && !materialText)) return
    const materialSubject = isCourse ? DEFAULT_COURSE_SUBJECT : subject
    if (!materialSubject) { setErr('Subject is required.'); return }
    if (materialText.length > MAX_PASTED_TEXT_CHARS) {
      setErr(`Pasted text must be ${MAX_PASTED_TEXT_CHARS.toLocaleString()} characters or fewer.`)
      return
    }
    setErr(null); setMsg(null)
    setUploadStage(selectedFile ? 'uploading' : aiIsConfigured ? 'extracting' : 'saving')
    setGenerationStep(0)
    let storagePath = ''
    let extractedText = materialText
    let materialTitle = selectedFile ? filenameMaterialTitle(selectedFile.name) : pastedTextMaterialTitle(materialText)
    let extractError: string | null = null
    try {
      if (selectedFile) {
        assertReviewFile(selectedFile)
        setBusy('Uploading file...')
        storagePath = await uploadReviewFile(user.id, selectedFile)
      }

      if (aiIsConfigured) {
        setUploadStage('extracting')
        if (selectedFile) {
          setBusy('Extracting text from material...')
          try {
            extractedText = await extractTextFromFile({ storagePath, mimeType: selectedFile.type })
          } catch (e: any) {
            extractError = e.message
          }
        }
        setBusy('Generating reviewer title...')
        materialTitle = await generateMaterialTitle(
          extractedText.trim()
            ? { documentText: extractedText }
            : { storagePath, mimeType: selectedFile?.type },
        )
      }

      setUploadStage('saving')
      setBusy('Saving reviewer...')
      const { data, error } = await supabase.from('review_materials').insert({
        user_id: user.id, title: materialTitle, board_program: program.key, subject: materialSubject,
        source_filename: selectedFile?.name || 'Pasted text',
        file_uri: storagePath || null,
        mime_type: selectedFile?.type || 'text/plain',
        file_size: selectedFile?.size ?? new Blob([materialText]).size,
        extracted_text: extractedText || null
      }).select('*').single()
      if (error) throw error
      const savedMaterial = data as ReviewMaterial
      if (isCourse && materialSubject.trim()) {
        await supabase.from('user_subjects').upsert(
          { user_id: user.id, name: materialSubject },
          { onConflict: 'user_id,name', ignoreDuplicates: true }
        )
      }
      storagePath = ''
      setFile(null); setFileReady(false); setPastedText('')

      if (isCourse) {
        if (!aiIsConfigured) {
          setMsg(`Reviewer "${materialTitle}" saved under General. ${selectedFile ? 'The file name' : 'The first line of your text'} was used because AI is not configured.`)
          setErr('Automatic generation did not run. Configure AI, then generate study sets from this saved reviewer.')
          addToast({ type: 'error', title: 'AI is not configured', message: 'Study sets were not generated. Configure AI to generate them from this saved reviewer.' })
        } else {
          const generated: string[] = []
          const failures: string[] = []
          setUploadStage('generating')

          for (const [index, studySet] of COURSE_STUDY_SETS.entries()) {
            setGenerationStep(index + 1)
            setBusy(`Generating ${studySet.label}...`)
            try {
              const count = await generateStudySet(studySet.type, savedMaterial)
              generated.push(`${count} ${studySet.label}`)
            } catch (generationError) {
              failures.push(`${studySet.label}: ${getErrorMessage(generationError)}`)
            }
          }

          if (failures.length) {
            setMsg(`Reviewer "${materialTitle}" saved. Generated ${generated.join(', ') || 'no study sets'}.`)
            setErr(`Some study sets could not be generated: ${failures.join(' | ')}`)
            addToast({ type: 'error', title: 'Some study sets were not generated', message: failures.join('; ') })
          } else {
            const extractionNote = extractError ? ' Text extraction failed, so generation used the saved file.' : ''
            setMsg(`Reviewer "${materialTitle}" saved. Automatically generated ${generated.join(', ')}.${extractionNote}`)
            addToast({ type: 'success', title: 'Study sets ready', message: `${materialTitle}: flashcards, multiple choice, enumeration, and identification.` })
          }
        }
      } else {
        if (aiIsConfigured) {
          setUploadStage('generating')
          setBusy('Generating flashcards...')
          try {
            const count = await generateStudySet('flashcards', savedMaterial)
            setMsg(`Material "${materialTitle}" saved. Generated ${count} flashcards.`)
            addToast({ type: 'success', title: 'Flashcards ready', message: materialTitle })
          } catch (generationError) {
            setMsg(`Material "${materialTitle}" was saved.`)
            setErr(`Flashcards could not be generated: ${getErrorMessage(generationError)}`)
            addToast({ type: 'error', title: 'Flashcards were not generated', message: getErrorMessage(generationError) })
          }
        } else {
          setMsg(`Material "${materialTitle}" saved. Configure AI to generate flashcards from it.`)
          addToast({ type: 'success', title: 'Material saved', message: materialTitle })
        }
        if (extractError) setErr(extractError)
      }

      await loadMaterials()
    } catch (e: unknown) {
      let errorMessage = getErrorMessage(e)
      if (storagePath) {
        try {
          await removeReviewFile(storagePath)
        } catch (cleanupError) {
          errorMessage += ` The uploaded file could not be removed: ${getErrorMessage(cleanupError)}`
        }
      }
      setErr(errorMessage)
    } finally {
      setBusy(null)
      setUploadStage(null)
    }
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

  const selectedMaterialRecord = materials.find(material => material.id === selectedMaterial)

  if (!profile || !program) return null

  return (
    <div className="container workspace-page">
      <WorkspacePageHeader
        eyebrow={isCourse ? 'STUDY LIBRARY' : 'PHARMACY STUDY LIBRARY'} index="02" title={<>Your <em>{isCourse ? 'reviewers' : 'Pharmacy reviewers'}.</em></>}
        description={isCourse
          ? 'Upload your course notes once. Saving a reviewer automatically creates flashcards, multiple choice, enumeration, and identification practice.'
          : 'Give your BS Pharmacy notes a new life. Upload lecture decks, drug monographs, or review handouts to create PhLE flashcards and clinical drills.'}
        action={!aiIsConfigured && <Badge variant="warning" size="md"><Icon name="alert-triangle" size={12} /> AI not configured</Badge>}
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

      {busy && !uploadStage && (
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
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Upload Study Material</h3>
        </div>
        <div className="grid grid-2">
          {/* Upload Reviewer */}
          <Card variant="elevated" className="reviewer-upload-card" ref={uploadCardRef}>
          <CardContent className="reviewer-upload-content">
            <div className="reviewer-upload-form">
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

              <div className="reviewer-upload-tabs" role="group" aria-label="Choose a material input method">
                <button
                  type="button"
                  aria-pressed={uploadMode === 'file'}
                  className={`reviewer-upload-tab${uploadMode === 'file' ? ' is-active' : ''}`}
                  onClick={() => { setUploadMode('file'); setErr(null); setMsg(null) }}
                  disabled={!!busy}
                >
                  <Icon name="file-text" size={17} /> Files & Photos
                </button>
                <button
                  type="button"
                  aria-pressed={uploadMode === 'text'}
                  className={`reviewer-upload-tab${uploadMode === 'text' ? ' is-active' : ''}`}
                  onClick={() => { setUploadMode('text'); setErr(null); setMsg(null) }}
                  disabled={!!busy}
                >
                  <Icon name="edit" size={17} /> Paste Text
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div className="reviewer-upload-field">
                  <input
                    id="review-file-input"
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={event => {
                      const selectedFile = event.currentTarget.files?.[0] || null
                      event.currentTarget.value = ''
                      selectUploadFile(selectedFile)
                    }}
                    className="reviewer-upload-hidden-input"
                    aria-label="Choose a document or photo"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    capture="environment"
                    onChange={event => {
                      const selectedFile = event.currentTarget.files?.[0] || null
                      event.currentTarget.value = ''
                      selectUploadFile(selectedFile)
                    }}
                    className="reviewer-upload-hidden-input"
                    aria-label="Take a photo of study material"
                    tabIndex={-1}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={event => {
                      const selectedFile = event.currentTarget.files?.[0] || null
                      event.currentTarget.value = ''
                      selectUploadFile(selectedFile)
                    }}
                    className="reviewer-upload-hidden-input"
                    aria-label="Choose a photo from your device"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="reviewer-upload-dropzone"
                    onClick={() => documentInputRef.current?.click()}
                    onDragOver={event => event.preventDefault()}
                    onDrop={handleFileDrop}
                    disabled={!!busy}
                  >
                    <span className="reviewer-upload-icon" aria-hidden="true">
                      <Icon name={file ? fileIcon(file.type) : 'folder'} size={27} style={{ color: file ? fileIconColor(file.type) : 'var(--primary)' }} />
                    </span>
                    <span className="reviewer-upload-copy">
                      <span className="reviewer-upload-title">{file ? file.name : 'Tap to upload or drag & drop'}</span>
                      <span className="reviewer-upload-hint">
                        {file
                          ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${fileReady ? 'Ready to save' : 'Selected'}`
                          : 'PDF, Word, PowerPoint, JPG, PNG or WebP · Up to 10 MB'}
                      </span>
                    </span>
                    <span className="reviewer-upload-action">{file ? 'Choose another' : 'Choose files'}</span>
                  </button>
                  <div className="reviewer-upload-photo-actions">
                    <button type="button" className="reviewer-upload-photo-button" onClick={() => cameraInputRef.current?.click()} disabled={!!busy}>
                      <Icon name="camera" size={17} /> Camera
                    </button>
                    <button type="button" className="reviewer-upload-photo-button" onClick={() => galleryInputRef.current?.click()} disabled={!!busy}>
                      <Icon name="image" size={17} /> Gallery / Photos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="reviewer-upload-field">
                  <label htmlFor="review-pasted-text" className="reviewer-upload-label">PASTE YOUR STUDY NOTES</label>
                  <textarea
                    id="review-pasted-text"
                    className="reviewer-paste-input"
                    value={pastedText}
                    onChange={event => setPastedText(event.target.value)}
                    placeholder="Paste text from your notes, lecture slides, or study guide..."
                    maxLength={MAX_PASTED_TEXT_CHARS}
                    disabled={!!busy}
                    rows={8}
                  />
                  <div className="reviewer-paste-meta">
                    <span>Your text will be saved as a reviewer.</span>
                    <span>{pastedText.length.toLocaleString()} / {MAX_PASTED_TEXT_CHARS.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <p className="reviewer-upload-ai-note">
                {aiIsConfigured
                  ? file?.type.startsWith('image/')
                    ? `AI will scan text in your photo, create a title, and ${isCourse ? 'generate study sets' : 'generate flashcards'}.`
                    : `AI will create a title from your material and ${isCourse ? 'generate study sets' : 'generate flashcards'}.`
                  : uploadMode === 'text'
                    ? 'AI is not configured; the first line of your text will be used as the title.'
                    : file?.type.startsWith('image/')
                      ? 'AI is not configured; the photo file name will be used as its title. Configure AI for photo text scanning.'
                      : 'AI is not configured; the uploaded file name will be used as the title.'}
              </p>

              <div className="reviewer-upload-actions">
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={aiIsConfigured ? 'sparkles' : 'save'}
                  onClick={saveMaterial}
                  disabled={!!busy || (uploadMode === 'file' ? !file || !fileReady : !pastedText.trim())}
                  fullWidth
                >
                  {isCourse && aiIsConfigured
                    ? 'Save & generate study sets'
                    : aiIsConfigured
                      ? 'Generate flashcards with AI'
                      : 'Save Material'}
                </Button>
              </div>

              {uploadStage && currentUploadStep >= 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 14,
                    border: '1px solid var(--primary-border)',
                    borderRadius: 10,
                    background: 'var(--primary-bg)',
                  }}
                >
                  <Icon name="loader" size={19} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: 13 }}>
                      {uploadSteps[currentUploadStep].label}
                    </strong>
                    <span style={{ display: 'block', marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>
                      Step {currentUploadStep + 1} of {uploadSteps.length}
                      {uploadStage === 'generating' ? ` · Study set ${generationStep || 1} of ${isCourse ? COURSE_STUDY_SETS.length : 1}` : ''}
                    </span>
                  </div>
                </div>
              )}

              {!isCourse && (
              <div ref={generateCardRef} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GENERATE FROM A SAVED MATERIAL</span>
                  <Select
                    label="Material"
                    value={selectedMaterial}
                    onChange={e => setSelectedMaterial(e.target.value)}
                    options={[{ value: '', label: 'Select material...' }, ...materials.map(m => ({ value: m.id, label: `${m.title} — ${m.subject}` }))]}
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

    </div>
  )
}
