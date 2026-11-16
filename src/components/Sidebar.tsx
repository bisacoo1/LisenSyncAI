import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { Icon, Tooltip, type IconName } from '@/components/ui'
import { supabase } from '@/lib/supabase'

type StudySetMode = 'flashcards' | 'mcq' | 'diagnosis' | 'sequence' | 'enumeration' | 'identification'
type SubjectStudySet = { mode: StudySetMode; count: number }
type SubjectFolder = { subject: string; sets: SubjectStudySet[] }

const studySetLabels: Record<StudySetMode, { label: string; icon: IconName }> = {
  flashcards: { label: 'Flashcards', icon: 'book-open' },
  mcq: { label: 'Multiple choice', icon: 'file-text' },
  diagnosis: { label: 'Diagnosis', icon: 'brain' },
  sequence: { label: 'Sequence', icon: 'chevron-up-down' },
  enumeration: { label: 'Enumeration', icon: 'list-checks' },
  identification: { label: 'Identification', icon: 'search' },
}

function isStudySetMode(value: string): value is StudySetMode {
  return value in studySetLabels
}

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { path: '/practice', label: 'Practice', icon: 'practice' },
  { path: '/mock', label: 'Mock exam', icon: 'mock' },
  { path: '/analytics', label: 'Analytics', icon: 'analytics' }
]

const uploadItems: { path: string; label: string; icon: IconName; tab: string }[] = [
  { path: '/reviewer?tab=upload', label: 'Upload & materials', icon: 'upload', tab: 'upload' }
]

export function Sidebar({
  open = false,
  onToggle,
  onNavigate,
  collapsed = false
}: {
  open?: boolean
  onToggle?: () => void
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [studyFolders, setStudyFolders] = useState<SubjectFolder[]>([])
  const [studyFoldersLoading, setStudyFoldersLoading] = useState(true)
  const [studyFoldersError, setStudyFoldersError] = useState<string | null>(null)
  const [studySetsRetry, setStudySetsRetry] = useState(0)
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([])
  const isCompact = collapsed && !open
  const initials = (profile?.full_name || 'LisenSync Candidate')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const practiceParams = new URLSearchParams(location.search)
  const selectedSubject = location.pathname === '/practice' ? practiceParams.get('subject') : null
  const selectedMode = practiceParams.get('mode') || 'mcq'

  useEffect(() => {
    let cancelled = false
    if (!profile) {
      setStudyFolders([])
      setStudyFoldersError(null)
      setStudyFoldersLoading(false)
      return
    }

    const userId = profile.id
    const isCourse = profile.track === 'course'
    const allowedModes = new Set<StudySetMode>(
      isCourse
        ? ['flashcards', 'mcq', 'enumeration', 'identification']
        : ['flashcards', 'mcq', 'diagnosis', 'sequence']
    )
    const modeOrder: StudySetMode[] = isCourse
      ? ['flashcards', 'mcq', 'enumeration', 'identification']
      : ['flashcards', 'mcq', 'diagnosis', 'sequence']

    async function loadStudyFolders() {
      setStudyFoldersLoading(true)
      setStudyFoldersError(null)
      try {
        const [flashcardResult, practiceResult] = await Promise.all([
          supabase.from('flashcards').select('subject').eq('user_id', userId),
          supabase.from('practice_items').select('subject,type').eq('user_id', userId),
        ])
        if (flashcardResult.error) throw new Error(flashcardResult.error.message)
        if (practiceResult.error) throw new Error(practiceResult.error.message)

        const counts = new Map<string, Map<StudySetMode, number>>()
        const addStudySet = (subject: string, mode: StudySetMode) => {
          const subjectCounts = counts.get(subject) || new Map<StudySetMode, number>()
          subjectCounts.set(mode, (subjectCounts.get(mode) || 0) + 1)
          counts.set(subject, subjectCounts)
        }

        for (const card of flashcardResult.data || []) {
          if (card.subject) addStudySet(card.subject, 'flashcards')
        }
        for (const item of practiceResult.data || []) {
          if (item.subject && isStudySetMode(item.type) && allowedModes.has(item.type)) {
            addStudySet(item.subject, item.type)
          }
        }

        const folders = Array.from(counts.entries())
          .map(([subject, setCounts]) => ({
            subject,
            sets: Array.from(setCounts.entries())
              .map(([mode, count]) => ({ mode, count }))
              .sort((a, b) => modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode)),
          }))
          .sort((a, b) => a.subject.localeCompare(b.subject))

        if (cancelled) return
        setStudyFolders(folders)
        setExpandedSubjects(current => {
          const stillAvailable = current.filter(subject => folders.some(folder => folder.subject === subject))
          return stillAvailable.length ? stillAvailable : folders[0] ? [folders[0].subject] : []
        })
      } catch (error) {
        if (!cancelled) {
          setStudyFolders([])
          setStudyFoldersError(error instanceof Error ? error.message : 'An unexpected error occurred.')
        }
      } finally {
        if (!cancelled) setStudyFoldersLoading(false)
      }
    }

    void loadStudyFolders()
    return () => { cancelled = true }
  }, [profile?.id, profile?.track, studySetsRetry])

  function toggleSubjectFolder(subject: string) {
    if (isCompact) {
      setExpandedSubjects(current => current.includes(subject) ? current : [...current, subject])
      onToggle?.()
      return
    }
    setExpandedSubjects(current => current.includes(subject)
      ? current.filter(item => item !== subject)
      : [...current, subject])
  }

  return (
    <aside
      id="main-sidebar"
      className={`sidebar${open ? ' open' : ''}${isCompact ? ' collapsed' : ''}`}
      aria-label="Main sidebar"
    >
      <div className="sidebar-brand">
        <Brand inverse compact={isCompact} />
      </div>
      <div className="sidebar-nav-heading">
        <span>YOUR WORKSPACE</span>
        {onToggle && (
          <Tooltip content={open ? 'Close menu' : isCompact ? 'Expand sidebar' : 'Collapse sidebar'} position="right">
            <button
              className="sidebar-toggle"
              onClick={onToggle}
              aria-label={open ? 'Close menu' : isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={open ? 'x' : isCompact ? 'chevron-right' : 'chevron-left'} size={16} />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Workspace navigation">
        <ul className="sidebar-list">
          {navItems.filter((item) => item.path !== '/mock' || profile?.track !== 'course').map((item) => {
            const active = location.pathname === item.path
            const link = (
              <Link
                to={item.path}
                className={`sidebar-item${active ? ' active' : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={19} />
                <span className="sidebar-label">{item.label}</span>
                {active && <span className="sidebar-active-dot" aria-hidden="true" />}
              </Link>
            )
            return (
              <li key={item.path}>
                {isCompact ? (
                  <Tooltip content={item.label} position="right" delay={300}>
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}

          <li className="sidebar-section">
            <span>STUDY SETS</span>
          </li>
          {studyFoldersLoading && (
            <li className="sidebar-study-status" role="status">Loading study sets…</li>
          )}
          {!studyFoldersLoading && studyFoldersError && (
            <li className="sidebar-study-status sidebar-study-status--error" role="alert">
              <span>Couldn’t load study sets.</span>
              <button type="button" onClick={() => setStudySetsRetry(value => value + 1)}>Retry</button>
            </li>
          )}
          {!studyFoldersLoading && !studyFoldersError && studyFolders.length === 0 && (
            <li className="sidebar-study-status">No study sets yet. Upload a reviewer to create one.</li>
          )}
          {studyFolders.map((folder, index) => {
            const expanded = expandedSubjects.includes(folder.subject)
            const isActive = selectedSubject === folder.subject
            const folderId = `sidebar-study-folder-${index}`
            const folderButton = (
              <button
                type="button"
                className={`sidebar-subject-toggle${isActive ? ' active' : ''}`}
                onClick={() => toggleSubjectFolder(folder.subject)}
                aria-label={`${expanded && !isCompact ? 'Collapse' : 'Expand'} ${folder.subject} study sets`}
                aria-expanded={expanded && !isCompact}
                aria-controls={expanded && !isCompact ? folderId : undefined}
                title={isCompact ? folder.subject : undefined}
              >
                <Icon name="book-open" size={17} aria-hidden="true" />
                <span className="sidebar-label">{folder.subject}</span>
                <Icon name={expanded && !isCompact ? 'chevron-down' : 'chevron-right'} size={15} aria-hidden="true" />
              </button>
            )
            return (
              <li className="sidebar-subject-folder" key={folder.subject}>
                {isCompact ? (
                  <Tooltip content={folder.subject} position="right" delay={300}>{folderButton}</Tooltip>
                ) : folderButton}
                {expanded && !isCompact && (
                  <ul className="sidebar-study-set-list" id={folderId}>
                    {folder.sets.map(({ mode, count }) => {
                      const studySet = studySetLabels[mode]
                      const to = `/practice?mode=${mode}&subject=${encodeURIComponent(folder.subject)}`
                      const active = location.pathname === '/practice' &&
                        selectedSubject === folder.subject && selectedMode === mode
                      return (
                        <li key={mode}>
                          <Link
                            to={to}
                            className={`sidebar-study-set-link${active ? ' active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            aria-label={`${folder.subject} ${studySet.label}, ${count} items`}
                            onClick={onNavigate}
                          >
                            <Icon name={studySet.icon} size={15} aria-hidden="true" />
                            <span>{studySet.label}</span>
                            <small>{count}</small>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}

          {/* Keep uploads and saved reviewer materials reachable after replacing the reviewer nav item. */}
          <li className="sidebar-section">
            <span className="sidebar-section-label">UPLOAD</span>
          </li>
          {uploadItems.map((item) => {
            const active =
              location.pathname.startsWith('/side-by-side/') ||
              (location.pathname === '/reviewer' && location.search.includes(`tab=${item.tab}`))
            const link = (
              <Link
                to={item.path}
                className={`sidebar-item${active ? ' active' : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={19} />
                <span className="sidebar-label">{item.label}</span>
                {active && <span className="sidebar-active-dot" aria-hidden="true" />}
              </Link>
            )
            return (
              <li key={item.path}>
                {isCompact ? (
                  <Tooltip content={item.label} position="right" delay={300}>
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <div className="sidebar-note-rx" aria-hidden="true">Rx</div>
          <span>
            <strong>Daily PhLE Dose</strong>
            <small>Steady recall builds clinical mastery.</small>
          </span>
        </div>
        {user && (
          <div className="sidebar-profile">
            <span className="sidebar-avatar">{initials}</span>
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-name">{profile?.full_name || 'Pharmacy candidate'}</span>
              <span className="sidebar-profile-program">
                {profile ? (profile.track === 'course' ? 'Course mode' : PHARMACY_PROGRAM.shortName) : 'Set up your profile'}
              </span>
            </div>
            <Tooltip content="Sign out" position="right">
              <button
                className="sidebar-signout"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <Icon name="logout" size={17} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
