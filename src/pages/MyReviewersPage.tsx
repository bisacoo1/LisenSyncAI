import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { groupReviewersByFolder, type ReviewerFolder } from '@/lib/reviewerFolders'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { removeReviewFile } from '@/lib/storage'
import type { FriendConnection } from '@/lib/social'
import type { ReviewMaterial, UserSubject } from '@/types'
import { AnimatedNumber, Badge, Button, Card, CardContent, EmptyState, Icon, Input, Modal, Skeleton, type IconName, useToast } from '@/components/ui'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'

type ReviewerStudyMode = 'flashcards' | 'mcq' | 'diagnosis' | 'sequence' | 'enumeration' | 'identification'
type ModeCounts = Partial<Record<ReviewerStudyMode, number>>
type ReviewerEntry = { material: ReviewMaterial; modeCounts: ModeCounts; folderName: string }
type ReviewerShareTarget = { title: string; materialIds: string[] }
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

const SUBJECT_FOLDER_UNDO_WINDOW_MS = 8_000
const SUBJECT_FOLDER_DELETION_CHANGE_EVENT = 'pharmora:subject-folder-deletion-change'
const pendingSubjectFolderDeletions = new Set<string>()

function setSubjectFolderDeletionPending(folderId: string, pending: boolean) {
  if (pending) pendingSubjectFolderDeletions.add(folderId)
  else pendingSubjectFolderDeletions.delete(folderId)
  window.dispatchEvent(new Event(SUBJECT_FOLDER_DELETION_CHANGE_EVENT))
}

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
  const [shareTarget, setShareTarget] = useState<ReviewerShareTarget | null>(null)
  const [shareFriends, setShareFriends] = useState<FriendConnection[]>([])
  const [shareFriendsLoading, setShareFriendsLoading] = useState(false)
  const [shareFriendsError, setShareFriendsError] = useState<string | null>(null)
  const [sharingFriendId, setSharingFriendId] = useState<string | null>(null)
  const [sharedFriendIds, setSharedFriendIds] = useState<Set<string>>(() => new Set())
  const [removeFolderTarget, setRemoveFolderTarget] = useState<ReviewerFolder<ReviewerEntry> | null>(null)
  const [pendingFolderIds, setPendingFolderIds] = useState<Set<string>>(() => new Set(pendingSubjectFolderDeletions))
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({})
  const folderClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderDeletionTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const folderLongPressTriggered = useRef(false)
  const folderPointerType = useRef<string | null>(null)
  const isMounted = useRef(false)
  const selectedSubject = searchParams.get('subject')
  const selectedMaterialId = searchParams.get('material')
  const fromStudyMode = searchParams.get('from') === 'study'
  const requestedMode = searchParams.get('mode') || ''
  const requestedStudyMode = isReviewerStudyMode(requestedMode) ? requestedMode : null
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

  useEffect(() => {
    if (!shareTarget) return
    let active = true
    setShareFriendsLoading(true)
    setShareFriendsError(null)
    setShareFriends([])
    setSharedFriendIds(new Set())
    void (async () => {
      const { data, error: resultError } = await supabase.rpc('get_friend_connections')
      if (!active) return
      if (resultError) {
        setShareFriendsError(resultError.message)
      } else {
        setShareFriends(((data || []) as FriendConnection[]).filter(connection => connection.status === 'accepted'))
      }
      setShareFriendsLoading(false)
    })()
    return () => { active = false }
  }, [shareTarget?.materialIds])

  const folders = useMemo(() => groupReviewersByFolder(reviewers, subjectFolders), [reviewers, subjectFolders])
  const visibleFolders = useMemo(
    () => folders.filter(folder => !folder.id || !pendingFolderIds.has(folder.id)),
    [folders, pendingFolderIds],
  )
  const selectedFolder = folders.find(folder => folder.subject === selectedSubject)
  const selectedReviewer = selectedFolder?.reviewers.find(entry => entry.material.id === selectedMaterialId)
  const studyModes = profile?.track === 'course' ? courseStudyModes : boardStudyModes
  const requestedModeOption = studyModes.find(option => option.type === requestedStudyMode)
  const requestedModeCount = requestedStudyMode && selectedReviewer
    ? selectedReviewer.modeCounts[requestedStudyMode] || 0
    : 0
  const hasSelectedStudyDeck = selectedReviewer
    ? Object.values(selectedReviewer.modeCounts).some(count => (count || 0) > 0)
    : false

  useEffect(() => {
    isMounted.current = true
    const syncPendingFolders = () => setPendingFolderIds(new Set(pendingSubjectFolderDeletions))
    window.addEventListener(SUBJECT_FOLDER_DELETION_CHANGE_EVENT, syncPendingFolders)
    return () => {
      isMounted.current = false
      window.removeEventListener(SUBJECT_FOLDER_DELETION_CHANGE_EVENT, syncPendingFolders)
      if (folderClickTimer.current) window.clearTimeout(folderClickTimer.current)
      if (folderLongPressTimer.current) window.clearTimeout(folderLongPressTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!fromStudyMode || !requestedStudyMode || !requestedModeOption || !selectedReviewer || !requestedModeCount) return
    const params = new URLSearchParams({
      mode: requestedStudyMode,
      subject: selectedReviewer.material.subject,
      material: selectedReviewer.material.id,
      folder: selectedReviewer.folderName,
    })
    navigate(`/practice?${params.toString()}`, { replace: true })
  }, [fromStudyMode, requestedStudyMode, requestedModeOption, requestedModeCount, selectedReviewer, navigate])

  if (!profile) return null

  function studyBrowseParams() {
    const params = new URLSearchParams()
    if (fromStudyMode) {
      params.set('from', 'study')
      if (requestedStudyMode) params.set('mode', requestedStudyMode)
    }
    return params
  }

  function showSubjects() {
    setSearchParams(studyBrowseParams())
  }

  function showFolder(subject: string) {
    const params = studyBrowseParams()
    params.set('subject', subject)
    setSearchParams(params)
  }

  function showReviewer(entry: ReviewerEntry) {
    const params = studyBrowseParams()
    params.set('subject', entry.folderName)
    params.set('material', entry.material.id)
    setSearchParams(params)
  }

  function showFolderReviewers() {
    const params = studyBrowseParams()
    if (selectedSubject) params.set('subject', selectedSubject)
    setSearchParams(params)
  }

  function clearFolderClickTimer() {
    if (folderClickTimer.current) window.clearTimeout(folderClickTimer.current)
    folderClickTimer.current = null
  }

  function clearFolderLongPressTimer() {
    if (folderLongPressTimer.current) window.clearTimeout(folderLongPressTimer.current)
    folderLongPressTimer.current = null
  }

  function openFolderRemoval(folder: ReviewerFolder<ReviewerEntry>) {
    if (!folder.id) return
    clearFolderClickTimer()
    setRemoveFolderTarget(folder)
  }

  function closeFolderRemoval() {
    folderLongPressTriggered.current = false
    setRemoveFolderTarget(null)
  }

  function undoFolderRemoval(folder: ReviewerFolder<ReviewerEntry>) {
    if (!folder.id) return
    const timer = folderDeletionTimers.current.get(folder.id)
    if (timer === undefined) return
    window.clearTimeout(timer)
    folderDeletionTimers.current.delete(folder.id)
    setSubjectFolderDeletionPending(folder.id, false)
    addToast({
      type: 'info',
      title: 'Deletion undone',
      message: `${folder.subject} is back in My Reviewers.`,
      placement: 'center',
    })
  }

  async function permanentlyDeleteSubjectFolder(folder: ReviewerFolder<ReviewerEntry>) {
    if (!folder.id) return
    const folderId = folder.id
    try {
      const { data, error: deleteError } = await supabase.rpc('delete_subject_folder_contents', {
        p_folder_id: folderId,
      })
      if (deleteError) throw new Error(deleteError.message)

      const filePaths = Array.isArray(data)
        ? data.filter((path): path is string => typeof path === 'string' && path.length > 0 && !path.startsWith('data:'))
        : []
      if (isMounted.current) {
        setReviewers(previous => previous.filter(entry => entry.folderName !== folder.subject))
        setSubjectFolders(previous => previous.filter(subject => subject.id !== folderId))
      }
      setSubjectFolderDeletionPending(folderId, false)

      try {
        await Promise.all(filePaths.map(removeReviewFile))
      } catch (storageError) {
        addToast({
          type: 'error',
          title: 'Folder deleted, but some uploaded files remain',
          message: getErrorMessage(storageError),
        })
      }
    } catch (deleteError) {
      setSubjectFolderDeletionPending(folderId, false)
      addToast({
        type: 'error',
        title: 'Could not remove subject folder',
        message: getErrorMessage(deleteError),
      })
    }
  }

  function queueFolderRemoval(folder: ReviewerFolder<ReviewerEntry>) {
    if (!profile || !folder.id || folderDeletionTimers.current.has(folder.id)) return
    clearFolderClickTimer()
    const folderId = folder.id
    setSubjectFolderDeletionPending(folderId, true)
    const timer = window.setTimeout(() => {
      folderDeletionTimers.current.delete(folderId)
      void permanentlyDeleteSubjectFolder(folder)
    }, SUBJECT_FOLDER_UNDO_WINDOW_MS)
    folderDeletionTimers.current.set(folderId, timer)
    addToast({
      type: 'success',
      title: 'Subject deleted',
      message: `Removed from My Reviewers. Undo within 8 seconds to keep it.`,
      duration: SUBJECT_FOLDER_UNDO_WINDOW_MS,
      placement: 'center',
      action: { label: 'Undo', onClick: () => undoFolderRemoval(folder) },
    })
  }

  function confirmFolderRemoval() {
    if (!removeFolderTarget) return
    queueFolderRemoval(removeFolderTarget)
    folderLongPressTriggered.current = false
    setRemoveFolderTarget(null)
  }

  function handleFolderPointerDown(folder: ReviewerFolder<ReviewerEntry>, event: PointerEvent<HTMLButtonElement>) {
    folderPointerType.current = event.pointerType
    folderLongPressTriggered.current = false
    if (!folder.id || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return
    clearFolderLongPressTimer()
    folderLongPressTimer.current = window.setTimeout(() => {
      folderLongPressTriggered.current = true
      openFolderRemoval(folder)
    }, 600)
  }

  function handleFolderPointerEnd() {
    clearFolderLongPressTimer()
  }

  function handleFolderContextMenu(folder: ReviewerFolder<ReviewerEntry>, event: MouseEvent<HTMLButtonElement>) {
    if (folderPointerType.current !== 'touch' && folderPointerType.current !== 'pen') return
    event.preventDefault()
    folderLongPressTriggered.current = true
    clearFolderLongPressTimer()
    openFolderRemoval(folder)
  }

  function handleFolderClick(folder: ReviewerFolder<ReviewerEntry>, event: MouseEvent<HTMLButtonElement>) {
    if (folderLongPressTriggered.current) {
      folderLongPressTriggered.current = false
      event.preventDefault()
      return
    }
    if (event.detail === 0 || folderPointerType.current === 'touch' || folderPointerType.current === 'pen') {
      showFolder(folder.subject)
      return
    }
    if (event.detail >= 2) {
      clearFolderClickTimer()
      if (!folder.id) showFolder(folder.subject)
      return
    }
    clearFolderClickTimer()
    folderClickTimer.current = window.setTimeout(() => {
      showFolder(folder.subject)
      folderClickTimer.current = null
    }, 500)
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

  async function shareReviewer(friend: FriendConnection) {
    if (!shareTarget) return
    setSharingFriendId(friend.user_id)
    try {
      const { data, error: shareError } = await supabase.rpc('share_reviewers_with_friend', {
        p_material_ids: shareTarget.materialIds,
        p_friend_id: friend.user_id,
      })
      if (shareError) throw new Error(shareError.message)
      const sharedCount = Number(data)
      if (!Number.isInteger(sharedCount) || sharedCount !== shareTarget.materialIds.length) {
        throw new Error('The generated reviewer copy was not completed.')
      }
      setSharedFriendIds(previous => new Set(previous).add(friend.user_id))
      addToast({
        type: 'success',
        title: 'Study content shared',
        message: `${sharedCount} reviewer ${sharedCount === 1 ? 'deck is' : 'decks are'} now in ${friend.display_name}’s My Reviewers.`,
      })
    } catch (shareError) {
      addToast({
        type: 'error',
        title: 'Could not share reviewer',
        message: getErrorMessage(shareError),
      })
    } finally {
      setSharingFriendId(null)
    }
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
            action={(
              <div className="reviewer-header-actions">
                <Button
                  variant="secondary"
                  leftIcon="share"
                  disabled={!hasSelectedStudyDeck}
                  title={!hasSelectedStudyDeck ? 'Generate at least one study set before sharing this reviewer.' : undefined}
                  onClick={() => setShareTarget({ title: selectedReviewer.material.title, materialIds: [selectedReviewer.material.id] })}
                >
                  Share reviewer
                </Button>
                {(selectedReviewer.material.file_uri || selectedReviewer.material.extracted_text) && (
                  <Button variant="outline" leftIcon="file-text" onClick={() => navigate(`/side-by-side/${selectedReviewer.material.id}`)}>
                    Read with AI
                  </Button>
                )}
              </div>
            )}
          />

          <section className="reviewer-mode-section" aria-labelledby="reviewer-mode-title">
            <div className="reviewer-mode-heading">
              <span className="reviewer-mode-heading-icon"><Icon name="book-open" size={20} /></span>
              <div>
                <h2 id="reviewer-mode-title">How do you want to study?</h2>
                <p>
                  {fromStudyMode && requestedModeOption && !requestedModeCount
                    ? `${requestedModeOption.title} is not available for this reviewer. Choose another available set or go back to change your mode.`
                    : `${studyModes.filter(mode => (selectedReviewer.modeCounts[mode.type] || 0) > 0).length} study modes ready · choose one to begin.`}
                </p>
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
                    onClick={() => navigate(`/practice?mode=${mode.type}&subject=${encodeURIComponent(selectedReviewer.material.subject)}&material=${encodeURIComponent(selectedReviewer.material.id)}&folder=${encodeURIComponent(selectedReviewer.folderName)}`)}
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
            description={fromStudyMode && requestedModeOption
              ? `Choose a reviewer to start ${requestedModeOption.title}.`
              : `${selectedFolder.reviewers.length} reviewer ${selectedFolder.reviewers.length === 1 ? 'set' : 'sets'} in this subject folder.`}
            action={(
              <div className="reviewer-header-actions">
                <Button
                  variant="secondary"
                  leftIcon="share"
                  disabled={!selectedFolder.reviewers.some(entry => Object.values(entry.modeCounts).some(count => (count || 0) > 0))}
                  onClick={() => setShareTarget({
                    title: selectedFolder.subject,
                    materialIds: selectedFolder.reviewers
                      .filter(entry => Object.values(entry.modeCounts).some(count => (count || 0) > 0))
                      .map(entry => entry.material.id),
                  })}
                >
                  Share subject
                </Button>
                <Button variant="primary" leftIcon="upload" onClick={() => navigate('/reviewer?tab=upload')}>Upload materials</Button>
              </div>
            )}
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
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon="share"
                      disabled={!modeCount}
                      title={!modeCount ? 'Generate at least one study set before sharing this reviewer.' : undefined}
                      onClick={() => setShareTarget({ title: entry.material.title, materialIds: [entry.material.id] })}
                    >
                      Share reviewer
                    </Button>
                    {(entry.material.file_uri || entry.material.extracted_text) && (
                      <Button variant="ghost" size="sm" leftIcon="file-text" onClick={() => navigate(`/side-by-side/${entry.material.id}`)}>
                        Read with AI
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
            description={fromStudyMode && requestedModeOption
              ? `Choose a subject and reviewer. We’ll open it directly in ${requestedModeOption.title} when that set is available.`
              : 'Browse your saved reviewers by subject. Open a reviewer to choose from the study sets generated from it.'}
            action={(
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" leftIcon="plus" onClick={() => setCreateFolderOpen(true)}>Add subject</Button>
                <Button variant="primary" leftIcon="upload" onClick={() => navigate('/reviewer?tab=upload')}>Upload materials</Button>
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
          ) : visibleFolders.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <EmptyState
                  icon="folder"
                  title="No reviewers yet"
                  description="Upload study materials to create your first subject folder and study set."
                  action={{ label: 'Upload materials', variant: 'primary', onClick: () => navigate('/reviewer?tab=upload') }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="reviewer-folder-grid">
              {visibleFolders.map(folder => (
                <button
                  type="button"
                  className="reviewer-folder-card"
                  key={folder.subject}
                  onClick={event => handleFolderClick(folder, event)}
                  onDoubleClick={() => openFolderRemoval(folder)}
                  onPointerDown={event => handleFolderPointerDown(folder, event)}
                  onPointerUp={handleFolderPointerEnd}
                  onPointerLeave={handleFolderPointerEnd}
                  onPointerCancel={handleFolderPointerEnd}
                  onContextMenu={event => handleFolderContextMenu(folder, event)}
                  onKeyDown={event => {
                    if (event.key === 'Delete' && folder.id) {
                      event.preventDefault()
                      openFolderRemoval(folder)
                    }
                  }}
                  aria-keyshortcuts={folder.id ? 'Delete' : undefined}
                  aria-label={`${folder.subject}, ${folder.reviewers.length} reviewer ${folder.reviewers.length === 1 ? 'set' : 'sets'}${folder.id ? '. Double-click or long-press to delete this subject; press Delete when focused.' : ''}`}
                  title={folder.id ? 'Double-click or long-press to delete this subject' : undefined}
                >
                  <span className="reviewer-folder-icon"><Icon name="folder" size={23} /></span>
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
        open={Boolean(shareTarget)}
        onClose={() => { if (!sharingFriendId) setShareTarget(null) }}
        title={shareTarget ? `Share ${shareTarget.title}` : 'Share reviewer'}
        description={`Generated questions and flashcards from ${shareTarget?.materialIds.length || 0} reviewer set${shareTarget?.materialIds.length === 1 ? '' : 's'} will be copied into your friend’s My Reviewers. Uploaded files and extracted source text are not shared.`}
        size="md"
        closeOnOverlayClick={!sharingFriendId}
        closeOnEscape={!sharingFriendId}
        footer={<Button variant="secondary" onClick={() => setShareTarget(null)} disabled={sharingFriendId !== null}>Done</Button>}
      >
        {shareFriendsLoading ? (
          <div className="social-status" role="status">Loading your friends…</div>
        ) : shareFriendsError ? (
          <div className="social-status social-error" role="alert">
            <span>Could not load friends: {shareFriendsError}</span>
          </div>
        ) : shareFriends.length === 0 ? (
          <div className="social-empty-state">
            <Icon name="users" size={28} aria-hidden="true" />
            <strong>No accepted friends to share with yet.</strong>
            <span>Add a learner from the leaderboard and wait for them to accept.</span>
            <Button
              variant="outline"
              onClick={() => { setShareTarget(null); navigate('/friends') }}
            >
              Open friends
            </Button>
          </div>
        ) : (
          <ul className="social-person-list">
            {shareFriends.map(friend => {
              const initials = friend.display_name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()
              const alreadyShared = sharedFriendIds.has(friend.user_id)
              return (
                <li className="social-person-row" key={friend.friendship_id}>
                  <ProfileAvatar
                    className="social-person-avatar"
                    avatarId={friend.avatar_id}
                    avatarPath={friend.avatar_path}
                    avatarBorderId={friend.avatar_border}
                    initials={initials}
                  />
                  <div className="social-person-copy">
                    <strong>{friend.display_name}</strong>
                    <span>Level {friend.level}</span>
                  </div>
                  <Button
                    variant={alreadyShared ? 'outline' : 'primary'}
                    size="sm"
                    leftIcon={alreadyShared ? 'check' : 'share'}
                    disabled={alreadyShared || sharingFriendId !== null}
                    loading={sharingFriendId === friend.user_id}
                    onClick={() => void shareReviewer(friend)}
                  >
                    {alreadyShared ? 'Shared' : 'Share'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>
      <Modal
        open={Boolean(removeFolderTarget)}
        onClose={closeFolderRemoval}
        title={removeFolderTarget ? `Delete ${removeFolderTarget.subject}?` : 'Delete subject folder'}
        description={removeFolderTarget
          ? `This deletes the folder, ${removeFolderTarget.reviewers.length} reviewer ${removeFolderTarget.reviewers.length === 1 ? 'set' : 'sets'}, uploaded files, generated study content, and related practice history. You’ll have 8 seconds to undo after confirming.`
          : undefined}
        size="sm"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={closeFolderRemoval}>Cancel</Button>
            <Button variant="danger" leftIcon="trash" onClick={confirmFolderRemoval}>Delete folder</Button>
          </div>
        )}
      >
        <p>The folder will disappear immediately. Use Undo in the toast within 8 seconds to keep it.</p>
      </Modal>
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
