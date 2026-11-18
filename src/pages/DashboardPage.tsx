import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram, getSubjectDetail } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type UserSubject } from '@/types'
import { AnimatedNumber, Badge, Button, Icon, ProgressBar, Reveal, Skeleton, useToast, type IconName } from '@/components/ui'

const tools: { number: string; icon: IconName; title: string; description: string; action: string; to: string }[] = [
  {
    number: '01',
    icon: 'upload',
    title: 'Make your study set',
    description: 'Turn your Pharmacy handouts and drug monographs into flashcards and clinical drills.',
    action: 'Add a reviewer',
    to: '/reviewer'
  },
  {
    number: '02',
    icon: 'brain',
    title: 'Put it into practice',
    description: 'Drill pharmacology, calculations, dispensing, and case-based recall.',
    action: 'Start practicing',
    to: '/practice'
  },
  {
    number: '03',
    icon: 'timer',
    title: 'Try the real thing',
    description: 'Get exam-day ready with a timed 6-module PhLE mock simulation.',
    action: 'Take a mock exam',
    to: '/mock'
  }
]

const courseTools: typeof tools = [
  {
    number: '01',
    icon: 'upload',
    title: 'Organize course materials',
    description: 'Upload lecture notes and class reviewers to create subject-based study sets.',
    action: 'Add course materials',
    to: '/reviewer',
  },
  {
    number: '02',
    icon: 'brain',
    title: 'Practice a course subject',
    description: 'Strengthen recall with flashcards and drills built from your uploaded materials.',
    action: 'Start a study session',
    to: '/practice',
  },
  {
    number: '03',
    icon: 'bar-chart',
    title: 'Check your course progress',
    description: 'Review your practice accuracy and find subjects that may need more attention.',
    action: 'View analytics',
    to: '/analytics',
  },
]

export default function DashboardPage() {
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [dueCards, setDueCards] = useState(0)
  const [dueSubject, setDueSubject] = useState('')
  const [hasInProgressMock, setHasInProgressMock] = useState(false)
  const [reviewerCount, setReviewerCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [examDateInput, setExamDateInput] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const isCourse = profile?.track === 'course'
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase.from('attempts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(500)
      setAttempts((data as Attempt[]) || [])
      const dueBefore = new Date().toISOString()
      const { count } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .lte('next_review_at', dueBefore)
      setDueCards(count || 0)
      if (isCourse) {
        setHasInProgressMock(false)
      } else {
        const { data: activeMock, error: activeMockError } = await supabase
          .from('mock_exams')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'in_progress')
          .limit(1)
          .maybeSingle()
        if (activeMockError) {
          addToast({ type: 'error', title: 'Could not load mock exam status', message: activeMockError.message })
        } else {
          setHasInProgressMock(Boolean(activeMock))
        }
      }
      setDueSubject('')
      if (count) {
        const { data: firstDueCard, error: dueSubjectError } = await supabase
          .from('flashcards')
          .select('subject')
          .eq('user_id', profile.id)
          .lte('next_review_at', dueBefore)
          .order('next_review_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (dueSubjectError) {
          addToast({ type: 'error', title: 'Could not load due flashcards', message: dueSubjectError.message })
        } else {
          setDueSubject(firstDueCard?.subject || '')
        }
      }
      const { count: materialCount, error: materialCountError } = await supabase
        .from('review_materials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
      if (!materialCountError) setReviewerCount(materialCount ?? 0)
      if (isCourse) {
        const { data: subs } = await supabase.from('user_subjects').select('*').eq('user_id', profile.id).order('name')
        setUserSubjects((subs as UserSubject[]) || [])
      }
      setLoading(false)
    })()
  }, [profile?.id, isCourse])

  if (!profile || !program) return null

  const subjectNames = isCourse ? userSubjects.map(s => s.name) : program.subjects
  const overall = overallPercent(attempts)
  const readiness = readinessLabel(overall)
  const subjectStats = computeSubjectStats(attempts, subjectNames)
  const weak = subjectStats.filter((s) => s.weak && s.total > 0)
  const courseFocusSubjects = subjectStats
    .filter((s) => s.total > 0 && s.percent < overall)
    .sort((a, b) => a.percent - b.percent)
  const attentionSubjects = isCourse ? courseFocusSubjects : weak
  const focusSubject = (isCourse ? courseFocusSubjects : weak)[0]
    || subjectStats.find(s => s.total === 0)
    || subjectStats.slice().sort((a, b) => a.percent - b.percent)[0]
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
  const studyPlanSteps: { icon: IconName; title: string; description: string; action: string; to: string }[] = []
  if (hasInProgressMock) {
    studyPlanSteps.push({
      icon: 'timer',
      title: 'Continue your PhLE mock exam',
      description: 'Finish the timed simulation you already started.',
      action: 'Resume exam',
      to: '/mock',
    })
  }
  if (dueCards > 0) {
    studyPlanSteps.push({
      icon: 'book-open',
      title: `Review ${dueCards} due flashcard${dueCards === 1 ? '' : 's'}`,
      description: 'A quick spaced-repetition review keeps key facts fresh.',
      action: 'Review cards',
      to: dueFlashcardPath,
    })
  }
  if (focusSubject && !(reviewerCount === 0 && attempts.length === 0 && dueCards === 0 && !hasInProgressMock)) {
    studyPlanSteps.push({
      icon: 'target',
      title: focusSubject.total === 0
        ? `Build a baseline in ${focusSubject.subject}`
        : (isCourse ? focusSubject.percent < overall : focusSubject.weak)
          ? `Practice ${focusSubject.subject}`
          : `Keep your recall sharp in ${focusSubject.subject}`,
      description: focusSubject.total === 0
        ? 'Start with a short set to see what you already know.'
        : `${focusSubject.percent}% across ${focusSubject.total} attempts${isCourse
          ? focusSubject.percent < overall ? ' — below your overall practice average' : ' — keep your recall sharp'
          : focusSubject.weak ? ' — this module needs extra attention' : ' — your lowest-scoring module so far'}.`,
      action: 'Start practice',
      to: `/practice?subject=${encodeURIComponent(focusSubject.subject)}`,
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
  const nextStudyStep = studyPlanSteps[0]
  const primaryAction = loading || !nextStudyStep
    ? { label: 'Continue studying', to: '/practice' }
    : { label: nextStudyStep.action, to: nextStudyStep.to }

  async function saveExamDate() {
    if (!profile || !examDateInput) return
    setSavingDate(true)
    const { error } = await supabase.from('profiles').update({ target_exam_date: examDateInput }).eq('id', profile.id)
    setSavingDate(false)
    if (error) {
      addToast({ type: 'error', title: 'Could not save date', message: error.message })
      return
    }
    await refreshProfile()
    setExamDateInput('')
    addToast({ type: 'success', title: 'Exam date saved', message: 'Your countdown is up to date.' })
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <div className="section-kicker">
            <span className="eyebrow-dot" /> {isCourse ? 'Coursework dashboard' : 'BS Pharmacy overview'} <span>/ 01</span>
          </div>
          <h1>
            {isCourse ? <>Your classes, <em>in sync.</em></> : <>A good day to <em>make progress.</em></>}
          </h1>
          <p>
            {isCourse
              ? loading
                ? 'Getting your course workspace ready…'
                : !userSubjects.length
                  ? `${firstName ? `Welcome, ${firstName}. ` : ''}Add course materials to build your first subject-based study set.`
                  : `${firstName ? `Welcome back, ${firstName}. ` : 'Welcome back. '}Track your practice and keep your Pharmacy subjects moving forward.`
              : loading
                ? 'Getting your study space ready…'
                : !attempts.length && reviewerCount === 0
                  ? `${firstName ? `Welcome, ${firstName}. ` : ''}Add a reviewer to create your first personalized study set.`
                  : `${firstName ? `Welcome back, ${firstName}. ` : 'Welcome back. '}Here's how your PhLE preparation stands across all 6 Pharmacy modules.`}
          </p>
        </div>
        <Link to={primaryAction.to} className="workspace-primary-link">
          {primaryAction.label} <Icon name="arrow-right" size={17} />
        </Link>
      </header>

      <Reveal as="section" className="dashboard-section study-plan-section" aria-labelledby="study-plan-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">{isCourse ? 'Your next course steps' : 'Your next best steps'}</span>
            <h2 id="study-plan-title">{isCourse ? 'Today’s course study plan' : 'Today’s smart study plan'}</h2>
          </div>
          <span className="study-plan-goal">
            <Icon name="target" size={15} aria-hidden="true" />
            {dailyCompleted} of {dailyGoal} items today
          </span>
        </div>
        {loading ? (
          <div className="study-plan-loading" aria-label="Preparing your study plan">
            <Skeleton variant="text" width={260} />
            <Skeleton variant="text" width={190} />
          </div>
        ) : (
          <Reveal as="ol" className="study-plan-list motion-stagger">
            {studyPlanSteps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <Link to={step.to} className="study-plan-step">
                  <span className="study-plan-step-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="study-plan-step-icon" aria-hidden="true"><Icon name={step.icon} size={19} /></span>
                  <span className="study-plan-step-copy">
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  <span className="study-plan-step-action">{step.action}<Icon name="arrow-right" size={15} /></span>
                </Link>
              </li>
            ))}
          </Reveal>
        )}
      </Reveal>

      {isCourse ? (
        <Reveal as="section" className="course-overview-panel" aria-labelledby="course-overview-title">
          <div className="course-overview-copy">
            <span className="course-overview-kicker">
              <Icon name="book-open" size={16} aria-hidden="true" /> COURSEWORK / BS PHARMACY
            </span>
            <h2 id="course-overview-title">Progress across your classes.</h2>
            <p>
              {loading
                ? 'Gathering your course progress…'
                : userSubjects.length
                  ? `Keep practicing across your ${userSubjects.length} course subject${userSubjects.length === 1 ? '' : 's'} and build steady recall from your class materials.`
                  : 'Add course materials to create your first subject-based study set.'}
            </p>
            <Link to="/reviewer" className="course-overview-action">
              {reviewerCount === null || reviewerCount === 0 ? 'Add course materials' : 'Manage study sets'}
              <Icon name="arrow-right" size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="course-overview-metrics">
            <div className="course-overview-metric">
              <span>MY SUBJECTS</span>
              <strong>{loading ? '—' : <AnimatedNumber value={userSubjects.length} duration={900} />}</strong>
              <small>{loading ? 'Loading your subjects…' : userSubjects.length === 1 ? 'course subject' : 'course subjects'}</small>
            </div>
            <div className="course-overview-metric">
              <span>PRACTICE ACCURACY</span>
              <strong>{loading || !attempts.length ? '—' : <AnimatedNumber value={overall} suffix="%" duration={1100} />}</strong>
              <small>{loading ? 'Loading your progress…' : attempts.length ? `${attempts.length} answered items` : 'Start a session to build your baseline'}</small>
            </div>
            <Link to={dueFlashcardPath} className="course-overview-metric course-overview-metric--link">
              <span>REVIEWS DUE</span>
              <strong>{loading ? '—' : <AnimatedNumber value={dueCards} duration={1100} delay={120} />}</strong>
              <small>{loading ? 'Checking your cards…' : dueCards ? 'A quick review keeps topics fresh' : 'You’re all caught up'}</small>
            </Link>
          </div>
        </Reveal>
      ) : (
      <Reveal className="dashboard-feature-grid motion-stagger">
        <section className="readiness-panel" aria-labelledby="readiness-title">
          <div className="readiness-topline">
            <span>
              <Icon name="pill" size={16} /> PhLE READINESS
            </span>
            <span>BS PHARMACY / 01</span>
          </div>
          <div className="readiness-body">
            <div className="readiness-copy">
              <div className="readiness-label" id="readiness-title">
                OVERALL PRACTICE SCORE
              </div>
              <div className="readiness-score">
                {loading || attempts.length === 0 ? '—' : <AnimatedNumber value={overall} suffix="%" duration={1200} />}
              </div>
              <p>
                {loading
                  ? 'Gathering your progress…'
                  : attempts.length === 0
                    ? 'Your Pharmacy progress starts with your first practice session.'
                    : overall >= PASSING_RATE
                      ? 'You are on track for the PhLE. Keep that momentum going.'
                      : `${readiness.label}. Every practice session gets you closer to RPh.`}
              </p>
            </div>
            <div
              className="readiness-orbit"
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
            <span>PRC PhLE BENCHMARK {PASSING_RATE}%</span>
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
            <Link to="/analytics">
              View analytics <Icon name="arrow-up-right" size={15} />
            </Link>
          </div>
        </section>

        <section className="countdown-panel" aria-labelledby="countdown-title">
          <div className="countdown-top">
            <span className="countdown-icon">
              <Icon name="calendar" size={21} />
            </span>
            <span>PhLE COUNTDOWN</span>
            <Icon name="arrow-up-right" size={17} />
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
              {profile.target_exam_date ? 'UPDATE TARGET DATE' : 'SET YOUR TARGET DATE'}
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

      <section className="dashboard-section" aria-labelledby="momentum-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">THE LITTLE WINS</span>
            <h2 id="momentum-title">Your momentum</h2>
          </div>
          <span className="section-side-note">
            A LITTLE EVERY DAY ADDS UP <Icon name="arrow-up-right" size={15} />
          </span>
        </div>
        <Reveal className="momentum-grid motion-stagger">
          <div className="momentum-card">
            <div className="momentum-card-top">
              <span className="momentum-icon cobalt">
                <Icon name="trophy" size={19} />
              </span>
              <span>01</span>
            </div>
            <span className="momentum-label">STUDY LEVEL</span>
            <strong><AnimatedNumber value={profile.level || 1} duration={800} /></strong>
            <small><AnimatedNumber value={profile.xp || 0} duration={1100} delay={120} /> XP earned so far</small>
          </div>
          <div className="momentum-card">
            <div className="momentum-card-top">
              <span className="momentum-icon amber">
                <Icon name="flame" size={19} />
              </span>
              <span>02</span>
            </div>
            <span className="momentum-label">CURRENT STREAK</span>
            <strong>
              <AnimatedNumber value={profile.current_streak || 0} duration={900} delay={60} /> <em>days</em>
            </strong>
            <small>Personal best: <AnimatedNumber value={profile.longest_streak || 0} duration={1000} delay={120} /> days</small>
          </div>
          <div className="momentum-card">
            <div className="momentum-card-top">
              <span className="momentum-icon violet">
                <Icon name="target" size={19} />
              </span>
              <span>03</span>
            </div>
            <span className="momentum-label">DAILY GOAL</span>
            <strong>
              <AnimatedNumber value={dailyCompleted} duration={900} delay={120} />
              <em> / <AnimatedNumber value={dailyGoal} duration={900} delay={180} /></em>
            </strong>
            <ProgressBar
              value={dailyCompleted}
              max={dailyGoal}
              size="sm"
              variant="primary"
              ariaLabel="Daily study goal"
            />
            <small>
              {dailyCompleted >= dailyGoal
                ? 'Goal reached'
                : `${Math.max(0, dailyGoal - dailyCompleted)} items to go today`}
            </small>
          </div>
          <Link
            to={dueFlashcardPath}
            className={`momentum-card momentum-card--link${!loading && dueCards > 0 ? ' momentum-card--attention' : ''}`}
          >
            <div className="momentum-card-top">
              <span className="momentum-icon sky">
                <Icon name="book-open" size={19} />
              </span>
              <Icon name="arrow-up-right" size={16} />
            </div>
            <span className="momentum-label">FLASHCARDS DUE</span>
            <strong>{loading ? '—' : <AnimatedNumber value={dueCards} duration={1100} delay={120} />}</strong>
            <small>
              {loading ? 'Checking your cards…' : dueCards > 0 ? 'Ready for another look' : 'You’re all caught up'}
            </small>
          </Link>
        </Reveal>
      </section>

      <Reveal as="section" className="dashboard-section" aria-labelledby="toolkit-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">{isCourse ? 'TOOLS FOR YOUR CLASSES' : 'PICK UP WHERE YOU LEFT OFF'}</span>
            <h2 id="toolkit-title">{isCourse ? 'Your course toolkit' : 'Your study toolkit'}</h2>
          </div>
          <Link className="section-link" to="/analytics">
            See all progress <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="toolkit-grid">
          {(isCourse ? courseTools : tools).map((tool) => (
            <Link to={tool.to} className="toolkit-card" key={tool.number}>
              <div className="toolkit-top">
                <span className="toolkit-icon">
                  <Icon name={tool.icon} size={20} />
                </span>
                <span>{tool.number} / 03</span>
              </div>
              <div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
              </div>
              <div className="toolkit-action">
                {tool.action}
                <Icon name="arrow-up-right" size={17} />
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="dashboard-section" aria-labelledby="subjects-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">{isCourse ? 'YOUR COURSE SUBJECTS' : 'THE SIX PhLE MODULES'}</span>
            <h2 id="subjects-title">{isCourse ? 'Your course progress, at a glance' : 'Your Pharmacy subjects, at a glance'}</h2>
          </div>
          <Link className="section-link" to="/analytics">
            Detailed analytics <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="dashboard-bottom-grid">
          <div className="subject-panel">
            <div className="panel-title">
              <div>
                <h3>{isCourse ? 'Course Subject Performance' : 'PhLE Module Performance'}</h3>
                <p>{isCourse ? `${subjectNames.length} course subjects` : program.name}</p>
              </div>
              <Icon name="bar-chart" size={20} />
            </div>
            <div
              className="table-wrapper"
              role="region"
              aria-label={`${isCourse ? 'Course subject' : 'PhLE module'} performance, scrollable table`}
              tabIndex={0}
            >
              <table className="table subject-table">
                <thead>
                  <tr>
                    <th>{isCourse ? 'Course subject' : 'PhLE Module'}</th>
                    {!isCourse && <th>Weight</th>}
                    <th>Attempts</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>{isCourse ? 'Practice' : 'Drill'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td><Skeleton variant="text" width={120} /></td>
                        {!isCourse && <td><Skeleton variant="text" width={40} /></td>}
                        <td><Skeleton variant="text" width={40} /></td>
                        <td><Skeleton variant="text" width={40} /></td>
                        <td><Skeleton variant="text" width={55} /></td>
                        <td><Skeleton variant="text" width={60} /></td>
                      </tr>
                    ))
                  ) : (
                    subjectStats.length ? subjectStats.map((s) => {
                      const detail = isCourse ? undefined : getSubjectDetail(s.subject)
                      const belowAverage = isCourse && s.percent < overall
                      const needsFocus = isCourse ? belowAverage : s.weak
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
                          {!isCourse && <td>{detail ? `${detail.weightPercent}%` : '—'}</td>}
                          <td>{s.total}</td>
                          <td>{s.total === 0 ? '—' : <AnimatedNumber value={s.percent} suffix="%" duration={800} delay={120} />}</td>
                          <td>
                            {s.total === 0 ? (
                              <Badge size="sm">No data yet</Badge>
                            ) : (
                              <Badge variant={needsFocus ? 'warning' : 'success'} size="sm" dot>
                                {isCourse ? belowAverage ? 'Below average' : 'At/above average' : s.weak ? 'Needs focus' : 'On track'}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <Link
                              to="/practice"
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
                        <td colSpan={isCourse ? 5 : 6}>
                          {isCourse
                            ? <>No course subjects yet. <Link to="/reviewer">Add course materials</Link> to get started.</>
                            : 'No subject performance to show yet.'}
                        </td>
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
            <span className="section-kicker">{isCourse ? 'COURSE STUDY FOCUS' : 'YOUR NEXT FOCUS'}</span>
            <h3>
              {loading
                ? 'Finding your focus…'
                : isCourse
                  ? courseFocusSubjects.length
                    ? 'Build confidence in a few subjects.'
                    : attempts.length
                      ? 'Good progress across your subjects.'
                      : subjectNames.length
                        ? 'Ready for your first practice session.'
                        : 'Add a course subject to begin.'
                  : weak.length
                    ? 'A little extra attention.'
                    : attempts.length
                      ? 'Looking good so far.'
                      : 'Every RPh journey starts somewhere.'}
            </h3>
            <p>
              {loading
                ? 'Your insights are on their way.'
                : isCourse
                  ? courseFocusSubjects.length
                    ? 'These subjects are below your overall practice average. Choose one for a focused study session.'
                    : attempts.length
                      ? 'Keep practicing regularly to strengthen recall across your coursework.'
                      : subjectNames.length
                        ? 'Try a short subject practice set to see what you already know.'
                        : 'Upload course materials to create a subject-based study set, then practice it here.'
                  : weak.length
                    ? 'These PhLE modules are below your 75% target. A little focused practice can go a long way.'
                    : attempts.length
                      ? 'No Pharmacy modules are flagged right now. Keep building on your progress.'
                      : 'Complete a practice session to see which PhLE modules need your attention.'}
            </p>
            {attentionSubjects.length > 0 && (
              <ul>
                {attentionSubjects.slice(0, 3).map((s) => (
                  <li key={s.subject}>
                    <span>{s.subject}</span>
                    <strong><AnimatedNumber value={s.percent} suffix="%" duration={800} delay={120} /></strong>
                  </li>
                ))}
              </ul>
            )}
            <Link to={isCourse && !subjectNames.length ? '/reviewer' : '/practice'}>
              {isCourse
                ? subjectNames.length ? 'Practice a course subject' : 'Add course materials'
                : attempts.length ? 'Practice a Pharmacy module' : 'Start your first session'}{' '}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </Reveal>
      <div className="dashboard-endnote">
        <span>{isCourse ? 'YOUR COURSEWORK, ONE DAY AT A TIME.' : 'YOUR JOURNEY TO RPh, ONE DAY AT A TIME.'}</span>
        <span>{isCourse ? 'PHARMORA AI / COURSE MODE' : 'PHARMORA AI / BS PHARMACY'}</span>
      </div>
    </div>
  )
}
