import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { groupReviewersByFolder } from '@/lib/reviewerFolders'
import type { ReviewMaterial, UserSubject } from '@/types'
import { AnimatedNumber, Badge, Button, Card, CardContent, EmptyState, Icon, Input, Modal, Skeleton, type IconName, useToast } from '@/components/ui'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'

type ReviewerStudyMode = 'flashcards' | 'mcq' | 'diagnosis' | 'sequence' | 'enumeration' | 'identification'
type ModeCounts = Partial<Record<ReviewerStudyMode, number>>
type ReviewerEntry = { material: ReviewMaterial; modeCounts: ModeCounts; folderName: string }
type StudyModeOption = {
  type: ReviewerStudyMode
  title: string
  description: string
  icon: IconName
}

const boardStudyModes: StudyModeOption[] = [
  { type: 'flashcards', title: 'Study Mode', description: 'Review flashcards and check your recall.', icon: 'book-open' },
  { type: 'mcq', title: 'Exam Mode', description: 'Answer multiple-choice questions and see your score.', icon: 'file-text' },
  { type: 'diagnosis', title: 'Diagnosis', description: 'Recall clinical concepts from a prompt.', icon: 'brain' },
  { type: 'sequence', title: 'Sequence', description: 'Put steps and priorities in the right order.', icon: 'chevron-up-down' },
]

const courseStudyModes: StudyModeOption[] = [
  { type: 'flashcards', title: 'Study Mode', description: 'Review flashcards and check your recall.', icon: 'book-open' },
  { type: 'mcq', title: 'Exam Mode', description: 'Answer multiple-choice questions and see your score.', icon: 'file-text' },
  { type: 'identification', title: 'Identification', description: 'Type answers from memory.', icon: 'search' },
  { type: 'enumeration', title: 'Enumeration', description: 'Recall the items in a list.', icon: 'list-checks' },
]

function isReviewerStudyMode(value: string): value is ReviewerStudyMode {
  return value === 'flashcards' || value === 'mcq' || value === 'diagnosis' ||
    value === 'sequence' || value === 'enumeration' || value === 'identification'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function MyReviewersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviewers, setReviewers] = useState<ReviewerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [subjectFolders, setSubjectFolders] = useState<UserSubject[]>([])
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({})
  const selectedSubject = searchParams.get('subject')
  const selectedMaterialId = searchParams.get('material')
  const { addToast } = useToast()

  useEffect(() => {
    let cancelled = false
    if (!profile) {
      setLoading(false)
      return
    }

    const userId = profile.id
    async function loadReviewers() {
      setLoading(true)
      setError(null)
      try {
        const [materialsResult, flashcardsResult, practiceResult, foldersResult] = await Promise.all([
          supabase.from('review_materials').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('flashcards').select('material_id').eq('user_id', userId),
          supabase.from('practice_items').select('material_id,type').eq('user_id', userId),
          supabase.from('user_subjects').select('*').eq('user_id', userId).order('name'),
        ])
        if (materialsResult.error) throw new Error(materialsResult.error.message)
        if (flashcardsResult.error) throw new Error(flashcardsResult.error.message)
        if (practiceResult.error) throw new Error(practiceResult.error.message)
        if (foldersResult.error) throw new Error(foldersResult.error.message)
        const folders = (foldersResult.data || []) as UserSubject[]
        const folderNames = new Map(folders.map(folder => [folder.id, folder.name]))

        const counts = new Map<string, ModeCounts>()
        const addCount = (materialId: string, mode: ReviewerStudyMode) => {
          const current = counts.get(materialId) || {}
          current[mode] = (current[mode] || 0) + 1
          counts.set(materialId, current)
        }

        for (const card of flashcardsResult.data || []) {
          if (card.material_id) addCount(card.material_id, 'flashcards')
        }
        for (const item of practiceResult.data || []) {
          if (item.material_id && isReviewerStudyMode(item.type)) addCount(item.material_id, item.type)
        }

        const entries = ((materialsResult.data || []) as ReviewMaterial[]).map(material => ({
          material,
          modeCounts: counts.get(material.id) || {},
          folderName: (material.subject_folder_id && folderNames.get(material.subject_folder_id)) || material.subject,
        }))
        if (!cancelled) {
          setReviewers(entries)
          setSubjectFolders(folders)
        }
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadReviewers()
    return () => { cancelled = true }
  }, [profile?.id, retry])

  const folders = useMemo(() => groupReviewersByFolder(reviewers, subjectFolders), [reviewers, subjectFolders])

  if (!profile) return null

  const selectedFolder = folders.find(folder => folder.subject === selectedSubject)
  const selectedReviewer = selectedFolder?.reviewers.find(entry => entry.material.id === selectedMaterialId)
  const studyModes = profile.track === 'course' ? courseStudyModes : boardStudyModes

  function showSubjects() {
    setSearchParams({})
  }

  function showFolder(subject: string) {
    setSearchParams({ subject })
  }

  function showReviewer(entry: ReviewerEntry) {
    setSearchParams({ subject: entry.folderName, material: entry.material.id })
  }

  function showFolderReviewers() {
    if (selectedSubject) setSearchParams({ subject: selectedSubject })
    else showSubjects()
  }

  async function createSubjectFolder() {
    if (!profile) return
    const name = newFolderName.trim()
    if (!name) return
    if (subjectFolders.some(folder => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      addToast({ type: 'error', title: 'Subject already exists', message: 'Choose a different subject folder name.' })
      return
    }

    setSavingFolder(true)
    try {
      const { data, error: insertError } = await supabase
        .from('user_subjects')
        .insert({ user_id: profile.id, name })
        .select('*')
        .single()
      if (insertError) throw new Error(insertError.message)
      setSubjectFolders(previous => [...previous, data as UserSubject].sort((a, b) => a.name.localeCompare(b.name)))
      setNewFolderName('')
      setCreateFolderOpen(false)
      addToast({ type: 'success', title: 'Subject folder created', message: name })
    } catch (createError) {
      addToast({ type: 'error', title: 'Could not create subject folder', message: getErrorMessage(createError) })
    } finally {
      setSavingFolder(false)
    }
  }

  async function moveReviewer(entry: ReviewerEntry) {
    const folderId = moveTargets[entry.material.id]
    if (!folderId) return
    const target = subjectFolders.find(folder => folder.id === folderId)
    if (!target || folderId === entry.material.subject_folder_id) return

    const { error: moveError } = await supabase.rpc('move_review_material_to_folder', {
      p_material_id: entry.material.id,
      p_folder_id: folderId,
    })
    if (moveError) {
      addToast({ type: 'error', title: 'Could not move reviewer', message: moveError.message })
      return
    }

    setMoveTargets(previous => ({ ...previous, [entry.material.id]: '' }))
    setRetry(value => value + 1)
    addToast({ type: 'success', title: 'Reviewer moved', message: `${entry.material.title} → ${target.name}` })
  }

  return (
    <div className="container workspace-page my-reviewers-page">
      {selectedMaterialId && selectedReviewer ? (
        <>
          <div className="review-library-backrow">
            <Button variant="ghost" leftIcon="arrow-left" onClick={showFolderReviewers}>
              {selectedSubject}
            </Button>
          </div>
          <WorkspacePageHeader
            eyebrow="MY REVIEWERS"
            index="SET"
            title={<>{selectedReviewer.material.title}</>}
            description={`${selectedReviewer.folderName}${selectedReviewer.folderName !== selectedReviewer.material.subject ? ` · Content subject: ${selectedReviewer.material.subject}` : ''}${selectedReviewer.material.source_filename ? ` · ${selectedReviewer.material.source_filename}` : ''}`}
            action={selectedReviewer.material.file_uri || selectedReviewer.material.extracted_text ? (
              <Button variant="secondary" leftIcon="file-text" onClick={() => navigate(`/side-by-side/${selectedReviewer.material.id}`)}>
                Open reviewer
              </Button>
            ) : undefined}
          />

          <section className="reviewer-mode-section" aria-labelledby="reviewer-mode-title">
            <div className="reviewer-mode-heading">
              <span className="reviewer-mode-heading-icon"><Icon name="book-open" size={20} /></span>
              <div>
                <h2 id="reviewer-mode-title">How do you want to study?</h2>
                <p>{studyModes.filter(mode => (selectedReviewer.modeCounts[mode.type] || 0) > 0).length} study modes ready · choose one to begin.</p>
              </div>
            </div>
            <div className="reviewer-mode-grid">
              {studyModes.map(mode => {
                const count = selectedReviewer.modeCounts[mode.type] || 0
                const isFlashcards = mode.type === 'flashcards'
                const countLabel = count
                  ? `${count} ${isFlashcards ? 'cards' : 'questions'} ready`
                  : 'No items generated yet'
                return (
                  <button
                    key={mode.type}
                    type="button"
                    className={`reviewer-mode-card${count ? '' : ' is-disabled'}`}
                    disabled={!count}
                    onClick={() => navigate(`/practice?mode=${mode.type}&subject=${encodeURIComponent(selectedReviewer.material.subject)}&material=${encodeURIComponent(selectedReviewer.material.id)}`)}
                    aria-label={`${mode.title}. ${countLabel}`}
                  >
                    <span className="reviewer-mode-icon"><Icon name={mode.icon} size={21} /></span>
                    <span className="reviewer-mode-title">{mode.title}</span>
                    <span className="reviewer-mode-description">{mode.description}</span>
                    <span className="reviewer-mode-count">
                      {count ? (
                        <>
                          <AnimatedNumber value={count} duration={700} delay={80} /> {isFlashcards ? 'cards' : 'questions'} ready
                        </>
                      ) : countLabel}
                    </span>
                  </button>
                )
              })}
            </div>
            {!studyModes.some(mode => (selectedReviewer.modeCounts[mode.type] || 0) > 0) && (
              <Card variant="outlined" className="reviewer-no-modes">
                <CardContent>
                  <EmptyState
                    icon="sparkles"
                    title="No study sets generated yet"
                    description={profile.track === 'course'
                      ? 'This reviewer is saved, but it does not have generated questions yet. You can still open the reviewer document.'
                      : 'Generate flashcards or practice questions from this saved reviewer to study it here.'}
                    action={profile.track === 'course'
                      ? undefined
                      : {
                          label: 'Generate study sets',
                          variant: 'primary',
                          onClick: () => navigate(`/reviewer?tab=generate&material=${encodeURIComponent(selectedReviewer.material.id)}`),
                        }}
                  />
                </CardContent>
              </Card>
            )}
          </section>
        </>
      ) : selectedSubject && selectedFolder ? (
        <>
          <div className="review-library-backrow">
            <Button variant="ghost" leftIcon="arrow-left" onClick={showSubjects}>Back to My reviewers</Button>
          </div>
          <WorkspacePageHeader
            eyebrow="MY REVIEWERS"
            index="SUBJECT FOLDER"
            title={<>{selectedFolder.subject}</>}
            description={`${selectedFolder.reviewers.length} reviewer ${selectedFolder.reviewers.length === 1 ? 'set' : 'sets'} in this subject folder.`}
            action={<Button variant="primary" leftIcon="upload" onClick={() => navigate('/reviewer?tab=upload')}>Upload reviewer</Button>}
          />
          {selectedFolder.reviewers.length ? (
            <div className="reviewer-set-list">
              {selectedFolder.reviewers.map(entry => {
              const modeCount = studyModes.filter(mode => (entry.modeCounts[mode.type] || 0) > 0).length
              return (
                <article className="reviewer-set-card" key={entry.material.id}>
                  <button type="button" className="reviewer-set-main" onClick={() => showReviewer(entry)}>
                    <span className="reviewer-set-icon"><Icon name="file-text" size={20} /></span>
                    <span className="reviewer-set-copy">
                      <strong>{entry.material.title}</strong>
                      <span>
                        {entry.material.source_filename || 'Saved reviewer'}
                        <span className="reviewer-set-separator" aria-hidden="true">·</span>
                        {new Date(entry.material.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="reviewer-set-count">
                      <Badge variant={modeCount ? 'primary' : 'default'} size="sm">
                        {modeCount ? <><AnimatedNumber value={modeCount} duration={700} delay={60} /> modes ready</> : 'No study sets'}
                      </Badge>
                    </span>
                    <Icon name="chevron-right" size={18} />
                  </button>
                  <div className="reviewer-set-actions">
                    <Button variant="outline" size="sm" leftIcon="book-open" onClick={() => showReviewer(entry)}>
                      Choose study mode
                    </Button>
                    {(entry.material.file_uri || entry.material.extracted_text) && (
                      <Button variant="ghost" size="sm" leftIcon="file-text" onClick={() => navigate(`/side-by-side/${entry.material.id}`)}>
                        Open reviewer
                      </Button>
                    )}
                    {subjectFolders.length > 0 && (
                      <>
                        <select
                          aria-label={`Move ${entry.material.title} to a subject folder`}
                          value={moveTargets[entry.material.id] || ''}
                          onChange={event => setMoveTargets(previous => ({ ...previous, [entry.material.id]: event.target.value }))}
                          style={{ minHeight: 36, border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', background: 'var(--panel-2)', color: 'var(--text)' }}
                        >
                          <option value="">Move to subject folder…</option>
                          {subjectFolders.map(folder => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void moveReviewer(entry)}
                          disabled={!moveTargets[entry.material.id] || moveTargets[entry.material.id] === entry.material.subject_folder_id}
                        >
                          Move
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              )
              })}
            </div>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <EmptyState
                  icon="reviewer"
                  title="This subject folder is empty"
                  description="Move a reviewer set here from one of your other subject folders."
                  action={{ label: 'Back to My reviewers', variant: 'outline', onClick: showSubjects }}
                />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <WorkspacePageHeader
            eyebrow="STUDY LIBRARY"
            index="MY REVIEWERS"
            title={<>My <em>reviewers.</em></>}
            description="Browse your saved reviewers by subject. Open a reviewer to choose from the study sets generated from it."
            action={(
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" leftIcon="plus" onClick={() => setCreateFolderOpen(true)}>Add subject</Button>
                <Button variant="primary" leftIcon="upload" onClick={() => navigate('/reviewer?tab=upload')}>Upload reviewer</Button>
              </div>
            )}
          />

          {loading ? (
            <div className="reviewer-folder-grid" aria-label="Loading reviewer folders">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card variant="outlined" key={index}>
                  <CardContent className="reviewer-folder-skeleton">
                    <Skeleton variant="text" width={180} />
                    <Skeleton variant="text" width={120} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card variant="outlined">
              <CardContent>
                <EmptyState
                  icon="alert-circle"
                  title="Couldn’t load your reviewers"
                  description={error}
                  action={{ label: 'Try again', variant: 'primary', onClick: () => setRetry(value => value + 1) }}
                />
              </CardContent>
            </Card>
          ) : folders.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <EmptyState
                  icon="reviewer"
                  title="No reviewers yet"
                  description="Upload a reviewer to create your first subject folder and study set."
                  action={{ label: 'Upload reviewer', variant: 'primary', onClick: () => navigate('/reviewer?tab=upload') }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="reviewer-folder-grid">
              {folders.map(folder => (
                <button
                  type="button"
                  className="reviewer-folder-card"
                  key={folder.subject}
                  onClick={() => showFolder(folder.subject)}
                  aria-label={`${folder.subject}, ${folder.reviewers.length} reviewer ${folder.reviewers.length === 1 ? 'set' : 'sets'}`}
                >
                  <span className="reviewer-folder-icon"><Icon name="reviewer" size={23} /></span>
                  <span className="reviewer-folder-copy">
                    <strong>{folder.subject}</strong>
                    <span>{folder.reviewers.length} reviewer {folder.reviewers.length === 1 ? 'set' : 'sets'}</span>
                    <small>{folder.reviewers.slice(0, 2).map(entry => entry.material.title).join(' · ')}</small>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <Modal
        open={createFolderOpen}
        onClose={() => { if (!savingFolder) setCreateFolderOpen(false) }}
        title="Add subject folder"
        description="Create a folder for your reviewer sets. Moving a reviewer won’t change its academic subject or practice questions."
        size="sm"
        closeOnOverlayClick={!savingFolder}
        closeOnEscape={!savingFolder}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={() => setCreateFolderOpen(false)} disabled={savingFolder}>Cancel</Button>
            <Button variant="primary" onClick={() => void createSubjectFolder()} loading={savingFolder} disabled={!newFolderName.trim()}>
              Create subject
            </Button>
          </div>
        )}
      >
        <Input
          label="Subject name"
          value={newFolderName}
          onChange={event => setNewFolderName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void createSubjectFolder() } }}
          placeholder="e.g. Pharmacology"
          maxLength={80}
          fullWidth
          required
        />
      </Modal>
    </div>
  )
}
