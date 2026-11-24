import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { generateRoadmapFocus } from '@/lib/ai'
import { getProgram, getSubjectDetail } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import {
  buildCoursePracticePaths,
  computeSubjectStats,
  getSubjectDailyTrend,
  mapCourseAttemptSubjectsToFolders,
  overallPercent,
  readinessLabel,
  selectDailyRoadmapSubject,
  summarizePracticeDays,
  type SubjectDailyTrendPoint,
} from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type UserSubject } from '@/types'
import { AnimatedNumber, Badge, Button, CircularProgress, Icon, Reveal, Skeleton, useToast, type IconName } from '@/components/ui'

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type DailyRoadmapFocus = {
  date: string
  subject: string
  aiGenerated?: boolean
  rationale?: string
  attemptsAtStart?: number
}

type ResumeStudy = {
  to: string
  subject: string
  mode: string
  folder: string
  setTitle: string
}

const STUDY_MODE_LABELS: Record<string, string> = {
  flashcards: 'Flashcards',
  mcq: 'Multiple choice',
  diagnosis: 'Diagnosis',
  sequence: 'Sequence',
  enumeration: 'Enumeration',
  identification: 'Identification',
}

function parseResumeStudy(value: unknown): ResumeStudy | null {
  if (!isRecord(value)
    || typeof value.to !== 'string'
    || !value.to.startsWith('/practice?')
    || typeof value.subject !== 'string'
    || typeof value.mode !== 'string') return null

  const params = new URLSearchParams(value.to.slice('/practice?'.length))
  if (!value.subject.trim() || params.get('subject') !== value.subject) return null

  return {
    to: value.to,
    subject: value.subject,
    mode: value.mode,
    folder: typeof value.folder === 'string' ? value.folder : '',
    setTitle: typeof value.setTitle === 'string' ? value.setTitle : '',
  }
}

export default function DashboardPage() {
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [dueCards, setDueCards] = useState(0)
  const [totalFlashcards, setTotalFlashcards] = useState(0)
  const [flashcardsCompletedToday, setFlashcardsCompletedToday] = useState(0)
  const [dueSubject, setDueSubject] = useState('')
  const [hasInProgressMock, setHasInProgressMock] = useState(false)
  const [reviewerCount, setReviewerCount] = useState<number | null>(null)
  const [coursePracticePaths, setCoursePracticePaths] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [dailyRoadmapFocus, setDailyRoadmapFocus] = useState<DailyRoadmapFocus | null>(null)
  const [resumeStudy, setResumeStudy] = useState<ResumeStudy | null>(null)
  const [generatingAiPlan, setGeneratingAiPlan] = useState(false)
  const [examDateInput, setExamDateInput] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const isCourse = profile?.track === 'course'
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([])

  useEffect(() => {
    const profileId = profile?.id
    if (!profileId) {
      setResumeStudy(null)
      return
    }

    try {
      const savedStudy = localStorage.getItem(`pharmora-resume-study:${profileId}`)
      setResumeStudy(savedStudy ? parseResumeStudy(JSON.parse(savedStudy)) : null)
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not load your saved study session',
        message: error instanceof Error ? error.message : 'Local storage is unavailable.',
      })
      setResumeStudy(null)
    }
  }, [profile?.id, addToast])

  useEffect(() => {
    if (!profile) return
    let active = true
    const userId = profile.id
    setLoading(true)
    setLoadError(null)
    setCoursePracticePaths({})
    ;(async () => {
      try {
        const [attemptResult, dueResult, materialResult, secondaryResult, flashcardResult] = await Promise.all([
          supabase.from('attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
          supabase.from('flashcards').select('id,last_reviewed_at', { count: 'exact' }).eq('user_id', userId).lte('next_review_at', new Date().toISOString()),
          supabase.from('review_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          isCourse
            ? supabase.from('user_subjects').select('*').eq('user_id', userId).order('name')
            : supabase.from('mock_exams').select('id').eq('user_id', userId).eq('status', 'in_progress').limit(1),
          supabase.from('flashcards').select('id,last_reviewed_at,material_id').eq('user_id', userId),
        ])
        const error = attemptResult.error || dueResult.error || materialResult.error || secondaryResult.error || flashcardResult.error
        if (error) throw error
        let loadedAttempts = (attemptResult.data as Attempt[]) || []
        if (isCourse) {
          const [materialsResult, practiceItemsResult] = await Promise.all([
            supabase.from('review_materials').select('id,subject,subject_folder_id').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('practice_items').select('id,material_id,type').eq('user_id', userId),
          ])
          if (materialsResult.error) throw materialsResult.error
          if (practiceItemsResult.error) throw practiceItemsResult.error

          const courseFolders = (secondaryResult.data as UserSubject[] | null) || []
          const courseMaterials = materialsResult.data || []
          const coursePracticeItems = practiceItemsResult.data || []
          const paths = buildCoursePracticePaths(
            courseMaterials,
            coursePracticeItems,
            flashcardResult.data || [],
            courseFolders
          )
          loadedAttempts = mapCourseAttemptSubjectsToFolders(
            loadedAttempts,
            coursePracticeItems,
            courseMaterials,
            courseFolders
          )
          if (!active) return
          setCoursePracticePaths(paths)
        }
        let firstDueSubject = ''
        if (dueResult.count) {
          const { data, error: dueSubjectError } = await supabase.from('flashcards').select('subject')
            .eq('user_id', userId).lte('next_review_at', new Date().toISOString())
            .order('next_review_at', { ascending: true }).limit(1).maybeSingle()
          if (dueSubjectError) throw dueSubjectError
          firstDueSubject = data?.subject || ''
        }
        if (!active) return
        const loadedUserSubjects = isCourse ? (secondaryResult.data as UserSubject[] | null) || [] : []
        const loadedSubjectNames = isCourse ? loadedUserSubjects.map(subject => subject.name) : program?.subjects || []
        const loadedSubjectStats = computeSubjectStats(loadedAttempts, loadedSubjectNames)
        const todayKey = localDateKey(new Date())
        const roadmapSubject = selectDailyRoadmapSubject(
          loadedSubjectStats,
          isCourse,
          overallPercent(loadedAttempts)
        )?.subject
        let dailySubject = roadmapSubject
        let savedDailyFocus: DailyRoadmapFocus | null = null
        if (dailySubject) {
          try {
            const storageKey = `pharmora-daily-roadmap:${userId}`
            const savedPlan = localStorage.getItem(storageKey)
            if (savedPlan) {
              const parsed: unknown = JSON.parse(savedPlan)
              if (
                isRecord(parsed) &&
                parsed.date === todayKey &&
                typeof parsed.subject === 'string' &&
                loadedSubjectNames.includes(parsed.subject)
              ) {
                dailySubject = parsed.subject
                savedDailyFocus = {
                  date: todayKey,
                  subject: parsed.subject,
                  ...(parsed.aiGenerated === true &&
                  typeof parsed.rationale === 'string' &&
                  typeof parsed.attemptsAtStart === 'number' &&
                  Number.isFinite(parsed.attemptsAtStart)
                    ? {
                        aiGenerated: true,
                        rationale: parsed.rationale,
                        attemptsAtStart: parsed.attemptsAtStart,
                      }
                    : {}),
                }
              }
            }
            const dailyFocus = savedDailyFocus || { date: todayKey, subject: dailySubject }
            localStorage.setItem(storageKey, JSON.stringify(dailyFocus))
          } catch (error) {
            addToast({
              type: 'error',
              title: 'Could not save today’s roadmap',
              message: error instanceof Error ? error.message : 'Local storage is unavailable.',
            })
          }
        }
        setDailyRoadmapFocus(
          dailySubject
            ? savedDailyFocus || { date: todayKey, subject: dailySubject }
            : null
        )
        setAttempts(loadedAttempts)
        setDueCards(dueResult.count ?? 0)
        const todayPrefix = todayKey
        const flashcards = (flashcardResult.data as { last_reviewed_at: string | null }[] | null) || []
        setTotalFlashcards(flashcards.length)
        setFlashcardsCompletedToday(flashcards.filter(card => card.last_reviewed_at?.slice(0, 10) === todayPrefix).length)
        setDueSubject(firstDueSubject)
        setReviewerCount(materialResult.count ?? 0)
        setHasInProgressMock(!isCourse && Boolean(secondaryResult.data?.length))
        setUserSubjects(loadedUserSubjects)
      } catch (error: any) {
        if (active) setLoadError(error?.message || 'Please check your connection and try again.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [profile?.id, isCourse, reloadCount])

  useEffect(() => {
    if (!profile) return
    const now = new Date()
    const nextLocalDay = new Date(now)
    nextLocalDay.setHours(24, 0, 0, 0)
    const timer = window.setTimeout(() => setReloadCount(value => value + 1), nextLocalDay.getTime() - now.getTime() + 1000)
    return () => window.clearTimeout(timer)
  }, [profile?.id, reloadCount])

  const courseSubjectTrends = useMemo(
    () => userSubjects.map(subject => ({
      subject: subject.name,
      points: getSubjectDailyTrend(attempts, subject.name),
    })),
    [attempts, userSubjects]
  )

  if (!profile || !program) return null

  if (loadError) return (
    <div className="dashboard-page">
      <header className="dashboard-heading"><div>
        <div className="section-kicker"><span className="eyebrow-dot" /> Study overview</div>
        <h1>Your dashboard is <em>temporarily unavailable.</em></h1>
        <p>We couldn't load your progress. Your saved data has not been changed.</p>
      </div></header>
      <div className="dashboard-load-error" role="alert">
        <Icon name="alert-circle" size={22} />
        <div><strong>Unable to load your study data</strong><p>{loadError}</p>
          <Button variant="primary" onClick={() => setReloadCount(value => value + 1)}>Try again</Button>
        </div>
      </div>
    </div>
  )

  const subjectNames = isCourse ? userSubjects.map(s => s.name) : program.subjects
  const overall = overallPercent(attempts)
  const readiness = readinessLabel(overall)
  const subjectStats = computeSubjectStats(attempts, subjectNames)
  const weak = subjectStats.filter((s) => s.weak && s.total > 0)
  const todayKey = localDateKey(new Date())
  const focusSubject = selectDailyRoadmapSubject(
    subjectStats,
    isCourse,
    overall,
    dailyRoadmapFocus?.date === todayKey ? dailyRoadmapFocus.subject : undefined
  )
  const aiRoadmapFocus = dailyRoadmapFocus?.date === todayKey && dailyRoadmapFocus.aiGenerated
    ? dailyRoadmapFocus
    : null
  const attemptsSinceAiPlan = aiRoadmapFocus && focusSubject
    ? Math.max(0, focusSubject.total - (aiRoadmapFocus.attemptsAtStart || 0))
    : 0
  const focusSubjectPath = !focusSubject
    ? '/practice'
    : isCourse
      ? coursePracticePaths[focusSubject.subject]
        || (focusSubject.total === 0
          ? `/reviewers?subject=${encodeURIComponent(focusSubject.subject)}`
          : `/practice?subject=${encodeURIComponent(focusSubject.subject)}`)
      : `/practice?subject=${encodeURIComponent(focusSubject.subject)}`
  const dueFlashcardPath = dueSubject
    ? `/practice?mode=flashcards&subject=${encodeURIComponent(dueSubject)}`
    : '/practice'
  const firstName = profile.full_name?.trim().split(/\s+/)[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const examDate = profile.target_exam_date ? new Date(`${profile.target_exam_date}T00:00:00`) : null
  const daysLeft = examDate ? Math.round((examDate.getTime() - today.getTime()) / 86400000) : null
  const dailyCompleted =
    profile.daily_goal_date === new Date().toISOString().slice(0, 10) ? profile.daily_items_completed || 0 : 0
  const dailyGoal = profile.daily_goal || 20
  const studyPlanSteps: { icon: IconName; title: string; description: string; action: string; to: string; kind?: 'flashcards' | 'baseline' | 'weakspots'; completed?: boolean; started?: boolean; locked?: boolean }[] = []
  if (hasInProgressMock) {
    studyPlanSteps.push({
      icon: 'timer',
      title: 'Continue your PhLE mock exam',
      description: 'Finish the timed simulation you already started.',
      action: 'Resume exam',
      to: '/mock',
    })
  }
  if (dueCards > 0 || totalFlashcards > 0) {
    studyPlanSteps.push({
      icon: 'book-open',
      title: dueCards > 0 ? `Review ${dueCards} due flashcard${dueCards === 1 ? '' : 's'}` : 'Review due flashcards',
      description: dueCards > 0
        ? 'A quick spaced-repetition review keeps key facts fresh.'
        : 'You’re all caught up. New cards will appear here when they’re due.',
      action: dueCards > 0 ? 'Review cards' : 'All caught up',
      to: dueFlashcardPath,
      kind: 'flashcards',
      completed: dueCards === 0,
    })
  }
  if (focusSubject && !(reviewerCount === 0 && attempts.length === 0 && dueCards === 0 && !hasInProgressMock)) {
    const baselineComplete = aiRoadmapFocus
      ? attemptsSinceAiPlan >= 1
      : focusSubject.total > 0
    const weakSpotsComplete = aiRoadmapFocus
      ? attemptsSinceAiPlan >= 5 && focusSubject.percent >= PASSING_RATE
      : focusSubject.total > 0 && focusSubject.percent >= PASSING_RATE
    studyPlanSteps.push({
      icon: 'target',
      title: aiRoadmapFocus
        ? `Practice ${focusSubject.subject}`
        : focusSubject.total === 0
        ? `Build a baseline in ${focusSubject.subject}`
        : (isCourse ? focusSubject.percent < overall : focusSubject.weak)
          ? `Practice ${focusSubject.subject}`
          : `Keep your recall sharp in ${focusSubject.subject}`,
      description: dueCards > 0
        ? `Review all ${dueCards} due flashcards first to unlock practice.`
        : aiRoadmapFocus
          ? `Complete a fresh set of practice questions in ${focusSubject.subject}.`
        : focusSubject.total === 0
          ? 'Start with a short set to see what you already know.'
        : `${focusSubject.percent}% across ${focusSubject.total} attempts${isCourse
          ? focusSubject.percent < overall ? ' — below your overall practice average' : ' — keep your recall sharp'
          : focusSubject.weak ? ' — this module needs extra attention' : ' — your lowest-scoring module so far'}.`,
      action: dueCards > 0 ? 'Review first' : 'Start practice',
      to: focusSubjectPath,
      kind: 'baseline',
      completed: baselineComplete,
      locked: dueCards > 0,
    })
    studyPlanSteps.push({
      icon: 'brain',
      title: aiRoadmapFocus
        ? `Reinforce ${focusSubject.subject}`
        : `Practice ${focusSubject.subject} weak spots`,
      description: aiRoadmapFocus
        ? `${focusSubject.percent}% accuracy — answer at least 5 new questions and keep accuracy at ${PASSING_RATE}% or higher.`
        : focusSubject.total === 0
        ? `Build a baseline in ${focusSubject.subject} first to unlock weak-spot practice.`
        : `${focusSubject.percent}% accuracy — practice until this subject reaches ${PASSING_RATE}%.`,
      action: focusSubject.total === 0 ? 'Start practice' : aiRoadmapFocus ? 'Continue practice' : 'Practice weak spots',
      to: focusSubjectPath,
      kind: 'weakspots',
      completed: weakSpotsComplete,
      started: aiRoadmapFocus ? attemptsSinceAiPlan > 0 : focusSubject.total > 0,
      locked: aiRoadmapFocus ? attemptsSinceAiPlan < 1 : focusSubject.total === 0,
    })
  }
  if (!studyPlanSteps.length && reviewerCount === 0) {
    studyPlanSteps.push({
      icon: 'upload',
      title: isCourse ? 'Create your first course study set' : 'Create your first study set',
      description: isCourse
        ? 'Add course materials to build subject-based practice material.'
        : 'Add a Pharmacy reviewer to build personalized practice material.',
      action: isCourse ? 'Add course materials' : 'Add a reviewer',
      to: '/reviewer',
    })
  } else if (!studyPlanSteps.length && !isCourse) {
    studyPlanSteps.push({
      icon: 'timer',
      title: 'Check your exam readiness',
      description: 'Try a timed simulation to see how you perform across the PhLE modules.',
      action: 'Take a mock exam',
      to: '/mock',
    })
  } else if (!studyPlanSteps.length) {
    studyPlanSteps.push({
      icon: 'brain',
      title: 'Continue your study session',
      description: isCourse
        ? 'Choose one of your course subjects and keep building your knowledge.'
        : 'Choose a subject and keep building your Pharmacy knowledge.',
      action: 'Start practice',
      to: '/practice',
    })
  }
  const activeStudyStepIndex = studyPlanSteps.findIndex(step => !step.completed && !step.locked)
  const activeStudyStep = studyPlanSteps[activeStudyStepIndex]
  const studyPlanComplete = studyPlanSteps.length > 0 && studyPlanSteps.every(step => step.completed)
  const primaryAction = resumeStudy
    ? { label: 'Resume your study', to: resumeStudy.to }
    : loading || !activeStudyStep
      ? { label: 'Continue studying', to: '/practice' }
      : { label: activeStudyStep.action, to: activeStudyStep.to }
  const showHeaderPrimaryAction = primaryAction.label !== 'Review cards'

  async function makeAiStudyPlan() {
    if (!profile || !focusSubject || generatingAiPlan) return
    setGeneratingAiPlan(true)
    try {
      const candidates = subjectStats.filter(subject =>
        subject.subject !== focusSubject.subject &&
        (subject.total > 0 || !isCourse || Boolean(coursePracticePaths[subject.subject]))
      )
      const plan = await generateRoadmapFocus({
        program: profile.board_program,
        currentSubject: focusSubject.subject,
        subjects: candidates.length ? candidates : subjectStats,
      })
      const selectedSubject = subjectStats.find(subject => subject.subject === plan.subject)
      if (!selectedSubject) throw new Error('The generated plan selected an unavailable subject.')

      const nextFocus: DailyRoadmapFocus = {
        date: todayKey,
        subject: plan.subject,
        aiGenerated: true,
        rationale: plan.rationale,
        attemptsAtStart: selectedSubject.total,
      }
      localStorage.setItem(`pharmora-daily-roadmap:${profile.id}`, JSON.stringify(nextFocus))
      setDailyRoadmapFocus(nextFocus)
      addToast({ type: 'success', title: 'Your new study plan is ready', message: `Today's roadmap now focuses on ${plan.subject}.` })
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not make a study plan',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setGeneratingAiPlan(false)
    }
  }

  async function saveExamDate() {
    if (!profile || !examDateInput) return
    setSavingDate(true)
    const { error } = await supabase.from('profiles').update({ target_exam_date: examDateInput }).eq('id', profile.id)
    setSavingDate(false)
    if (error) {
      addToast({ type: 'error', title: 'Could not save date', message: error.message })
      return
    }
    try {
      await refreshProfile()
      setExamDateInput('')
      addToast({ type: 'success', title: 'Exam date saved', message: 'Your countdown is up to date.' })
    } catch {
      addToast({ type: 'error', title: 'Date saved, but profile could not be refreshed', message: 'Please try reloading your profile.' })
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <h1>{firstName ? `Your daily dose, ${firstName}.` : 'Your daily dose.'}</h1>
          <p>
            {isCourse
              ? loading
                ? 'Loading your coursework…'
                : !userSubjects.length
                  ? 'Add course materials to build your first subject-based study set.'
                  : 'Track your practice and keep your Pharmacy subjects moving forward.'
              : loading
                ? 'Loading your study space…'
                : !attempts.length && reviewerCount === 0
                  ? 'Add a reviewer to create your first personalized study set.'
                  : 'Your PhLE preparation across all six Pharmacy modules.'}
          </p>
        </div>
        {showHeaderPrimaryAction && (
          <Link
            to={primaryAction.to}
            className={`workspace-primary-link${resumeStudy ? ' workspace-primary-link--resume' : ''}`}
          >
            {resumeStudy ? (
              <span className="workspace-primary-link-copy">
                <strong>{primaryAction.label}</strong>
                <small className="workspace-primary-link-context">
                  {resumeStudy.setTitle
                    ? `Set: ${resumeStudy.setTitle} · ${resumeStudy.subject}`
                    : `Subject: ${resumeStudy.folder ? `${resumeStudy.folder} · ` : ''}${resumeStudy.subject}`}
                  {' · '}{STUDY_MODE_LABELS[resumeStudy.mode] || 'Study mode'}
                </small>
              </span>
            ) : primaryAction.label}
            <Icon name="arrow-right" size={17} />
          </Link>
        )}
      </header>

      <Reveal as="section" className="dashboard-stats-strip motion-stagger" aria-label="Study summary">
        <div className="dashboard-stat">
          <span className="dashboard-stat-icon" aria-hidden="true"><Icon name="flame" size={20} /></span>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-label">Current streak</span>
            <strong><AnimatedNumber value={profile.current_streak || 0} duration={900} delay={60} /> <em>days</em></strong>
            <small>Personal best: <AnimatedNumber value={profile.longest_streak || 0} duration={1000} delay={120} /> days</small>
          </div>
        </div>
        <div className="dashboard-stat dashboard-stat--daily-goal">
          <CircularProgress
            value={dailyCompleted}
            max={dailyGoal}
            size={42}
            strokeWidth={4}
            ariaLabel="Daily study goal"
            className="dashboard-stat-goal-ring"
          />
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-label">Daily goal</span>
            <strong><AnimatedNumber value={dailyCompleted} duration={900} delay={120} /> <em>/ <AnimatedNumber value={dailyGoal} duration={900} delay={180} /></em></strong>
            <small>
              {dailyCompleted >= dailyGoal
                ? 'Goal reached'
                : `${Math.max(0, dailyGoal - dailyCompleted)} items to go today`}
            </small>
          </div>
        </div>
        <Link
          to={dueFlashcardPath}
          className={`dashboard-stat dashboard-stat--link${!loading && dueCards > 0 ? ' dashboard-stat--attention' : ''}`}
        >
          <span className="dashboard-stat-icon" aria-hidden="true"><Icon name="book-open" size={20} /></span>
          <span className="dashboard-stat-content">
            <span className="dashboard-stat-label">Cards to study</span>
            <strong>{loading ? '—' : <AnimatedNumber value={dueCards} duration={1100} delay={120} />}</strong>
            <small>
              {loading ? 'Checking your cards…' : dueCards > 0 ? 'Ready for another look' : 'You’re all caught up'}
            </small>
          </span>
        </Link>
      </Reveal>

      <div className="dashboard-actions-grid">
        <Reveal as="section" className="dashboard-section study-plan-section" aria-labelledby="study-plan-title">
          <div className="dashboard-section-heading dashboard-roadmap-heading">
            <div>
              <h2 id="study-plan-title">Study roadmap</h2>
              <p className="dashboard-section-subtitle">
                {aiRoadmapFocus
                  ? `AI focus: ${aiRoadmapFocus.rationale}`
                  : 'A suggested sequence based on what needs attention.'}
              </p>
            </div>
            <div className="dashboard-roadmap-actions">
              {!loading && focusSubject && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon="sparkles"
                  loading={generatingAiPlan}
                  onClick={makeAiStudyPlan}
                >
                  {aiRoadmapFocus ? 'Refresh AI focus' : 'Choose focus with AI'}
                </Button>
              )}
              {!loading && (
                <span className="dashboard-roadmap-count">
                  {studyPlanSteps.length} {studyPlanSteps.length === 1 ? 'step' : 'steps'}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="study-plan-loading" aria-label="Preparing your study plan">
              <Skeleton variant="text" width={260} />
              <Skeleton variant="text" width={190} />
            </div>
          ) : (
            <Reveal
              as="ol"
              className="study-plan-list dashboard-roadmap-list motion-stagger"
              data-step-count={studyPlanSteps.length}
            >
              {studyPlanSteps.map((step, index) => {
                let blockingStepIndex = -1
                if (step.locked) {
                  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
                    if (!studyPlanSteps[previousIndex].completed) {
                      blockingStepIndex = previousIndex
                      break
                    }
                  }
                }
                const actionLabel = step.locked
                  ? blockingStepIndex >= 0
                    ? `Finish Step ${blockingStepIndex + 1} first`
                    : 'Complete the prerequisite first'
                  : step.action
                const doneStamp = (
                  <span className="dashboard-roadmap-done-stamp" role="img" aria-label="Step complete">
                    <span className="dashboard-roadmap-done-stamp-top">STUDY PLAN</span>
                    <strong>DONE</strong>
                    <span className="dashboard-roadmap-done-stamp-bottom">EZ MODE</span>
                  </span>
                )
                const content = (
                  <>
                    <span className="study-plan-step-copy dashboard-roadmap-step-copy">
                      <span className="dashboard-roadmap-step-label">
                        {index === activeStudyStepIndex ? `Step ${index + 1} · Up next` : `Step ${index + 1}`}
                      </span>
                      <strong>{step.title}</strong>
                      <small>{step.description}</small>
                    </span>
                    <span className="study-plan-task-end">
                      {step.kind === 'flashcards' && (
                        <span className="study-plan-task-progress" aria-label={`${dueCards} due flashcards remaining`}>
                          <CircularProgress
                            value={step.completed ? 1 : flashcardsCompletedToday}
                            max={step.completed ? 1 : Math.max(dueCards + flashcardsCompletedToday, 1)}
                            size={38}
                            strokeWidth={4}
                            variant={dueCards === 0 ? 'success' : 'default'}
                            ariaLabel="Flashcard review progress today"
                          />
                        </span>
                      )}
                      {step.kind === 'flashcards' && step.completed && (
                        doneStamp
                      )}
                      {step.kind === 'baseline' && (
                        step.completed
                          ? doneStamp
                          : <span className="study-plan-task-status is-pending">Not done</span>
                      )}
                      {step.kind === 'weakspots' && (
                        step.completed
                          ? doneStamp
                          : <span className="study-plan-task-status is-pending">{step.started ? 'In progress' : 'Not started'}</span>
                      )}
                      <span className="study-plan-step-action">
                        {actionLabel}
                        <Icon
                          name={step.locked ? 'lock' : step.kind === 'flashcards' && step.completed ? 'check' : 'arrow-right'}
                          size={15}
                        />
                      </span>
                    </span>
                  </>
                )

                return (
                  <li
                    key={step.title}
                    aria-current={index === activeStudyStepIndex ? 'step' : undefined}
                    data-step-kind={step.kind}
                  >
                    {index < studyPlanSteps.length - 1 && (
                      <svg
                        className="dashboard-roadmap-connector"
                        viewBox="0 0 100 24"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d={index % 2 === 0
                            ? 'M 0 0 C 32 0, 68 24, 100 24'
                            : 'M 0 24 C 32 24, 68 0, 100 0'}
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray="4 5"
                          strokeLinecap="round"
                          strokeWidth="2"
                        />
                      </svg>
                    )}
                    <span className="dashboard-roadmap-node" aria-hidden="true">
                      <Icon name={step.icon} size={17} />
                    </span>
                    {step.locked || (step.kind === 'flashcards' && step.completed) ? (
                      <div className="study-plan-step" aria-disabled="true">
                        {content}
                      </div>
                    ) : (
                      <Link to={step.to} className="study-plan-step">
                        {content}
                      </Link>
                    )}
                  </li>
                )
              })}
            </Reveal>
          )}
          {!loading && studyPlanComplete && (
            <div className="dashboard-roadmap-complete">
              <Icon name="trophy" size={22} />
              <div className="dashboard-roadmap-complete-copy" role="status">
                <strong>Roadmap complete!</strong>
                <p>Excellent work—you completed every step. Keep that momentum going!</p>
              </div>
            </div>
          )}
        </Reveal>

      </div>

      {isCourse ? (
        <Reveal as="section" className="course-trends-panel" aria-labelledby="course-analytics-title">
          <div className="course-analytics">
            <div className="course-analytics-heading dashboard-section-heading">
              <div>
                <h2 id="course-analytics-title">Course subject trends</h2>
                <p className="dashboard-section-subtitle">Score trends and practice consistency across your subjects.</p>
              </div>
              <span>Last 14 days</span>
            </div>
            {loading ? (
              <p className="course-analytics-empty" role="status">Loading subject analytics…</p>
            ) : userSubjects.length === 0 ? (
              <p className="course-analytics-empty">Add course subjects to see your analytics.</p>
            ) : (
              <>
                <SubjectDailyTrendChart trends={courseSubjectTrends} />
                <PracticeDaysList trends={courseSubjectTrends} />
              </>
            )}
          </div>
        </Reveal>
      ) : (
      <Reveal className="dashboard-feature-grid motion-stagger">
        <section className="readiness-panel" aria-labelledby="readiness-title">
          <div className="readiness-topline">
            <h2 id="readiness-title"><Icon name="pill" size={16} /> PhLE readiness</h2>
          </div>
          <div className="readiness-body">
            <div className="readiness-copy">
              <div className="readiness-label">Overall practice score</div>
              <div className="readiness-score">
                {loading || attempts.length === 0 ? '—' : <AnimatedNumber value={overall} suffix="%" duration={1200} />}
              </div>
              <p>
                {loading
                  ? 'Gathering your progress…'
                  : attempts.length === 0
                    ? 'Your Pharmacy progress starts with your first practice session.'
                    : overall >= PASSING_RATE
                      ? 'Your practice score is at or above the benchmark. Keep building your readiness.'
                      : `${readiness.label}. Every practice session gets you closer to RPh.`}
              </p>
            </div>
            <div
              className="readiness-orbit"
              role="img"
              style={{ ['--readiness-fill' as string]: `${Math.min(overall, 100)}%` } as CSSProperties}
              aria-label={
                loading
                  ? 'Loading practice score'
                  : attempts.length
                    ? `Overall score ${overall} percent, PhLE benchmark ${PASSING_RATE} percent`
                    : `No practice score yet; PhLE benchmark ${PASSING_RATE} percent`
              }
            >
              <div>
                <Icon name="target" size={20} />
                <strong>{PASSING_RATE}%</strong>
                <span>PhLE TARGET</span>
              </div>
            </div>
          </div>
          <div className="readiness-progress-label">
            <span>
              {attempts.length ? <AnimatedNumber value={overall} suffix="% overall" duration={1200} /> : 'Your starting point'}
            </span>
            <span>PRC PhLE benchmark {PASSING_RATE}%</span>
          </div>
          <div
            className="readiness-progress"
            role={!loading && attempts.length ? 'progressbar' : undefined}
            aria-label={!loading && attempts.length ? 'Overall practice score' : undefined}
            aria-valuemin={!loading && attempts.length ? 0 : undefined}
            aria-valuemax={!loading && attempts.length ? 100 : undefined}
            aria-valuenow={!loading && attempts.length ? overall : undefined}
            aria-hidden={loading || !attempts.length ? true : undefined}
          >
            <span style={{ width: `${overall}%` }} />
            <i />
          </div>
          <div className="readiness-bottom">
            <span>
              <strong>{loading ? '—' : <AnimatedNumber value={attempts.length} duration={1100} />}</strong> attempts tracked
            </span>
            <span>
              <strong><AnimatedNumber value={subjectNames.length} duration={1100} delay={120} /></strong> {isCourse ? 'course subjects' : 'PhLE modules'}
            </span>
          </div>
        </section>

        <section className="countdown-panel" aria-labelledby="countdown-title">
          <div className="countdown-top">
            <span className="countdown-icon">
              <Icon name="calendar" size={21} />
            </span>
            <span>Exam countdown</span>
          </div>
          <div className="countdown-content">
            <span className="countdown-overline">A DATE TO WORK TOWARDS</span>
            <h2 id="countdown-title">
              {daysLeft == null ? (
                'Your PhLE exam day.'
              ) : daysLeft < 0 ? (
                'A new date awaits.'
              ) : (
                <>
                  <AnimatedNumber value={daysLeft} duration={1200} delay={150} />{' '}
                  <span>{daysLeft === 1 ? 'day' : 'days'} to go.</span>
                </>
              )}
            </h2>
            <p>
              {daysLeft == null
                ? 'Set your target Pharmacist Licensure Exam date and make every study day count.'
                : daysLeft < 0
                  ? 'Your target date has passed. Set a new PhLE date to keep going.'
                  : `Until ${examDate!.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`}
            </p>
          </div>
          <div className="countdown-form">
            <label htmlFor="exam-date">
              {profile.target_exam_date ? 'Update target date' : 'Set your target date'}
            </label>
            <div>
              <input
                id="exam-date"
                type="date"
                value={examDateInput}
                onChange={(e) => setExamDateInput(e.target.value)}
              />
              <Button variant="secondary" onClick={saveExamDate} loading={savingDate} disabled={!examDateInput}>
                {profile.target_exam_date ? 'Update' : 'Set date'}
              </Button>
            </div>
          </div>
        </section>
      </Reveal>
      )}

      {!isCourse && (
      <Reveal as="section" className="dashboard-section" aria-labelledby="subjects-title">
        <div className="dashboard-bottom-grid">
          <div className="subject-panel">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="subjects-title">Module progress</h2>
              </div>
            </div>
            <div className="panel-title">
              <div>
                <h3>PhLE module performance</h3>
                <p>{program.name}</p>
              </div>
              <Icon name="bar-chart" size={20} />
            </div>
            <div
              className="table-wrapper"
              role="region"
              aria-label="PhLE module performance, scrollable table"
              tabIndex={0}
            >
              <table className="table subject-table">
                <thead>
                  <tr>
                    <th>PhLE Module</th>
                    <th>Weight</th>
                    <th>Attempts</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Drill</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td><Skeleton variant="text" width={120} /></td>
                        <td><Skeleton variant="text" width={40} /></td>
                        <td><Skeleton variant="text" width={40} /></td>
                        <td><Skeleton variant="text" width={40} /></td>
                        <td><Skeleton variant="text" width={55} /></td>
                        <td><Skeleton variant="text" width={60} /></td>
                      </tr>
                    ))
                  ) : (
                    subjectStats.length ? subjectStats.map((s) => {
                      const detail = getSubjectDetail(s.subject)
                      const needsFocus = s.weak
                      return (
                        <tr key={s.subject}>
                          <td>
                            <div className="subject-cell">
                              {detail && (
                                <span className="subject-cell-icon" aria-hidden="true">
                                  <Icon name={detail.icon} size={14} />
                                </span>
                              )}
                              <div>
                                <div>{s.subject}</div>
                                {detail && <span className="subject-cell-sub">{detail.moduleCode}</span>}
                              </div>
                            </div>
                          </td>
                          <td>{detail ? `${detail.weightPercent}%` : '—'}</td>
                          <td>{s.total}</td>
                          <td>{s.total === 0 ? '—' : <AnimatedNumber value={s.percent} suffix="%" duration={800} delay={120} />}</td>
                          <td>
                            {s.total === 0 ? (
                              <Badge size="sm">No data yet</Badge>
                            ) : (
                              <Badge variant={needsFocus ? 'warning' : 'success'} size="sm" dot>
                                {s.weak ? 'Needs focus' : 'On track'}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <Link
                              to={isCourse
                                ? coursePracticePaths[s.subject] || `/practice?subject=${encodeURIComponent(s.subject)}`
                                : `/practice?subject=${encodeURIComponent(s.subject)}`}
                              className="module-drill-link"
                              aria-label={`Practice ${s.subject}`}
                            >
                              Practice <Icon name="arrow-right" size={12} />
                            </Link>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={6}>No subject performance to show yet.</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="focus-panel">
            <span className="focus-icon">
              <Icon name="target" size={20} />
            </span>
            <h3>
              {loading
                ? 'Finding your focus…'
                : weak.length
                  ? 'A little extra attention.'
                  : attempts.length
                    ? 'Looking good so far.'
                    : 'Every RPh journey starts somewhere.'}
            </h3>
            <p>
              {loading
                ? 'Your insights are on their way.'
                : weak.length
                  ? 'These PhLE modules are below your 75% target. A little focused practice can go a long way.'
                  : attempts.length
                    ? 'No Pharmacy modules are flagged right now. Keep building on your progress.'
                    : 'Complete a practice session to see which PhLE modules need your attention.'}
            </p>
            {weak.length > 0 && (
              <ul>
                {weak.slice(0, 3).map((s) => (
                  <li key={s.subject}>
                    <span>{s.subject}</span>
                    <strong><AnimatedNumber value={s.percent} suffix="%" duration={800} delay={120} /></strong>
                  </li>
                ))}
              </ul>
            )}
            <Link to={focusSubject ? `/practice?subject=${encodeURIComponent(focusSubject.subject)}` : '/practice'}>
              {attempts.length ? 'Practice a Pharmacy module' : 'Start your first session'}{' '}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </Reveal>
      )}
    </div>
  )
}

type CourseSubjectTrend = { subject: string; points: SubjectDailyTrendPoint[] }

const trendColors = [
  'var(--primary)',
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  '#0284c7',
  '#7c3aed',
  '#c026d3',
]

function SubjectDailyTrendChart({ trends }: { trends: CourseSubjectTrend[] }) {
  const data = trends[0]?.points || []
  const daysPerPage = 7
  const [chartStart, setChartStart] = useState<number | null>(null)
  const rangeStart = chartStart ?? Math.max(0, data.length - daysPerPage)
  const rangeEnd = Math.min(rangeStart + daysPerPage, data.length)
  const visibleData = data.slice(rangeStart, rangeEnd)
  const visibleTrends = trends.map(trend => ({
    ...trend,
    points: trend.points.slice(rangeStart, rangeEnd),
  }))
  const activeTrends = visibleTrends.filter(trend => trend.points.some(day => day.percent !== null))
  const hasTrendHistory = trends.some(trend => trend.points.some(day => day.percent !== null))
  const activeDays = visibleData.filter((_, index) => visibleTrends.some(trend => trend.points[index]?.total))
  const totalQuestions = trends.reduce(
    (sum, trend) => sum + trend.points.slice(rangeStart, rangeEnd).reduce((count, day) => count + day.total, 0),
    0
  )
  const width = 600
  const height = 140
  const pad = { top: 12, right: 24, bottom: 30, left: 38 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const x = (index: number) => pad.left + (index / Math.max(visibleData.length - 1, 1)) * innerWidth
  const y = (percent: number) => pad.top + innerHeight - (percent / 100) * innerHeight
  const series = visibleTrends.map((trend, index) => {
    const segments: string[] = []
    let segment: string[] = []
    trend.points.forEach((day, dayIndex) => {
      if (day.percent === null) {
        if (segment.length > 1) segments.push(segment.join(' '))
        segment = []
      } else {
        segment.push(`${x(dayIndex)},${y(day.percent)}`)
      }
    })
    if (segment.length > 1) segments.push(segment.join(' '))
    return {
      ...trend,
      active: trend.points.some(day => day.percent !== null),
      color: trendColors[index % trendColors.length],
      segments,
    }
  })
  const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const rangeLabel = visibleData.length
    ? `${dateLabel(visibleData[0].date)} – ${dateLabel(visibleData[visibleData.length - 1].date)}`
    : ''
  const maxStart = Math.max(0, data.length - daysPerPage)

  return (
    <div>
      {hasTrendHistory ? (
        <div className="course-trend-chart">
          <div className="course-trend-chart-navigation">
            <button
              type="button"
              className="course-trend-chart-nav-button"
              aria-label="Show earlier dates"
              onClick={() => setChartStart(Math.max(0, rangeStart - daysPerPage))}
              disabled={rangeStart === 0}
            >
              <Icon name="arrow-left" size={18} />
            </button>
            <span aria-live="polite">{rangeLabel}</span>
            <button
              type="button"
              className="course-trend-chart-nav-button"
              aria-label="Show later dates"
              onClick={() => setChartStart(Math.min(maxStart, rangeStart + daysPerPage))}
              disabled={rangeStart >= maxStart}
            >
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
          {activeTrends.length ? (
            <div className="course-trend-chart-scroll">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`Daily accuracy trends for ${activeTrends.length} subjects from ${rangeLabel}, across ${activeDays.length} practice days. Point labels show accuracy percentages.`}
                style={{ width: '100%', minWidth: 520, display: 'block', height: 'auto' }}
              >
              <text x={pad.left} y="8" fontSize="10" fontWeight="700" fill="var(--muted)">Accuracy (%)</text>
              {[0, 25, 50, 75, 100].map(value => (
                <g key={value}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={y(value)}
                    y2={y(value)}
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray={value === 75 ? '5 4' : undefined}
                  />
                  <text x={pad.left - 7} y={y(value) + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--muted)">
                    {value}%
                  </text>
                </g>
              ))}
              {series.map(item => item.segments.map((points, index) => (
                <polyline
                  key={`${item.subject}-${index}`}
                  points={points}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )))}
              {series.map(item => item.points.map((day, index) => day.percent === null ? null : (
                <g key={`${item.subject}-${day.date}`}>
                  <circle
                    cx={x(index)}
                    cy={y(day.percent)}
                    r="3"
                    fill={item.color}
                    stroke="var(--panel)"
                    strokeWidth="1.25"
                  >
                    <title>{`${item.subject} · ${new Date(`${day.date}T00:00:00`).toLocaleDateString()}: ${day.percent}% accuracy (${day.total} questions answered)`}</title>
                  </circle>
                  <text
                    x={x(index)}
                    y={y(day.percent) + (day.percent >= 90 ? 15 : -8)}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--text)"
                  >
                    {`${day.percent}%`}
                  </text>
                </g>
              )))}
              {visibleData.map((day, index) => (
                <text
                  key={`date-${day.date}`}
                  x={x(index)}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--muted)"
                >
                  {dateLabel(day.date)}
                </text>
              ))}
              </svg>
            </div>
          ) : (
            <p className="course-analytics-empty">No practice recorded from {rangeLabel}.</p>
          )}
          {activeTrends.length > 0 && <SubjectTrendLegend trends={series} />}
          <div className="course-trend-summary">
            <span><strong>{activeDays.length}</strong> practice days</span>
            <span><strong>{totalQuestions}</strong> questions answered</span>
          </div>
        </div>
      ) : (
        <p className="course-analytics-empty">Practice any course subject to see your daily accuracy trends.</p>
      )}
      {!hasTrendHistory && <SubjectTrendLegend trends={series} />}
    </div>
  )
}

function SubjectTrendLegend({ trends }: { trends: (CourseSubjectTrend & { active: boolean; color: string })[] }) {
  const activeTrends = trends.filter(trend => trend.active)
  if (activeTrends.length === 1) {
    const latestPoint = [...activeTrends[0].points].reverse().find(point => point.percent !== null)
    return (
      <div className="course-trend-current" aria-label={`Current subject trend`}>
        <span style={{ backgroundColor: activeTrends[0].color }} aria-hidden="true" />
        <strong>{activeTrends[0].subject}</strong>
        <small>
          {latestPoint?.percent != null
            ? `Latest accuracy: ${latestPoint.percent}%`
            : 'Practiced in the last 14 days'}
        </small>
      </div>
    )
  }

  return (
    <ul className="course-trend-legend" aria-label="Course subjects">
      {trends.map(trend => (
        <li key={trend.subject}>
          <span style={{ backgroundColor: trend.active ? trend.color : 'var(--muted)' }} aria-hidden="true" />
          {trend.subject}
          {!trend.active && <small>No practice</small>}
        </li>
      ))}
    </ul>
  )
}

function PracticeDaysList({ trends }: { trends: CourseSubjectTrend[] }) {
  const practiceDays = summarizePracticeDays(trends)

  return (
    <details className="course-practice-days">
      <summary className="course-practice-days-heading">
        <span className="course-practice-days-title">Practice days</span>
        <span className="course-practice-days-count">{practiceDays.length} active days in the last 14 days</span>
        <span className="course-practice-days-chevron" aria-hidden="true" />
      </summary>
      {practiceDays.length ? (
        <ul className="course-practice-days-list">
          {practiceDays.map(day => (
            <li key={day.date}>
              <time dateTime={day.date}>
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
              <strong>{day.percent}%</strong>
              <small>{day.total} questions · {day.subjects} subject{day.subjects === 1 ? '' : 's'}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="course-analytics-empty">No practice days across your subjects in the last 14 days.</p>
      )}
    </details>
  )
}
