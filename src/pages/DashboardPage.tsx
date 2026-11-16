import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram, getSubjectDetail } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt, type UserSubject } from '@/types'
import { Badge, Button, Icon, ProgressBar, Skeleton, useToast, type IconName } from '@/components/ui'

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

export default function DashboardPage() {
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const program = profile ? getProgram(profile.board_program) : null
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [dueCards, setDueCards] = useState(0)
  const [dueSubject, setDueSubject] = useState('')
  const [reviewerCount, setReviewerCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [examDateInput, setExamDateInput] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const isCourse = profile?.track === 'course'
  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase.from('attempts').select('*').eq('user_id', profile.id).limit(500)
      setAttempts((data as Attempt[]) || [])
      const dueBefore = new Date().toISOString()
      const { count } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .lte('next_review_at', dueBefore)
      setDueCards(count || 0)
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
  const primaryAction =
    !loading && reviewerCount === 0 && attempts.length === 0
      ? { label: 'Add your first reviewer', to: '/reviewer' }
      : !loading && dueCards > 0
        ? { label: 'Review due flashcards', to: dueFlashcardPath }
        : { label: 'Continue studying', to: '/practice' }

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
            <span className="eyebrow-dot" /> BS PHARMACY OVERVIEW <span>/ 01</span>
          </div>
          <h1>
            A good day to <em>make progress.</em>
          </h1>
          <p>
            {loading
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

      <div className="dashboard-feature-grid">
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
              <div className="readiness-score">{loading || attempts.length === 0 ? '—' : `${overall}%`}</div>
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
              style={{
                background: `conic-gradient(#7dd3fc ${Math.min(overall, 100)}%, rgba(191, 219, 254, .16) 0)`
              }}
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
            <span>{attempts.length ? `${overall}% overall` : 'Your starting point'}</span>
            <span>{isCourse ? 'SCORE TARGET' : 'PRC PhLE BENCHMARK'} {PASSING_RATE}%</span>
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
              <strong>{loading ? '—' : attempts.length}</strong> attempts tracked
            </span>
            <span>
              <strong>{subjectNames.length}</strong> {isCourse ? 'study subjects' : 'PhLE modules'}
            </span>
            <Link to="/analytics">
              View analytics <Icon name="arrow-up-right" size={15} />
            </Link>
          </div>
        </section>

        {!isCourse && (
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
                  {daysLeft} <span>{daysLeft === 1 ? 'day' : 'days'} to go.</span>
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
        )}
      </div>

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
        <div className="momentum-grid">
          <div className="momentum-card">
            <div className="momentum-card-top">
              <span className="momentum-icon cobalt">
                <Icon name="trophy" size={19} />
              </span>
              <span>01</span>
            </div>
            <span className="momentum-label">STUDY LEVEL</span>
            <strong>{profile.level || 1}</strong>
            <small>{profile.xp || 0} XP earned so far</small>
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
              {profile.current_streak || 0} <em>days</em>
            </strong>
            <small>Personal best: {profile.longest_streak || 0} days</small>
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
              {dailyCompleted}
              <em> / {dailyGoal}</em>
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
          <Link to={dueFlashcardPath} className="momentum-card momentum-card--link">
            <div className="momentum-card-top">
              <span className="momentum-icon sky">
                <Icon name="book-open" size={19} />
              </span>
              <Icon name="arrow-up-right" size={16} />
            </div>
            <span className="momentum-label">FLASHCARDS DUE</span>
            <strong>{loading ? '—' : dueCards}</strong>
            <small>
              {loading ? 'Checking your cards…' : dueCards > 0 ? 'Ready for another look' : 'You’re all caught up'}
            </small>
          </Link>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="toolkit-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span>
            <h2 id="toolkit-title">Your study toolkit</h2>
          </div>
          <Link className="section-link" to="/analytics">
            See all progress <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="toolkit-grid">
          {(isCourse ? tools.filter(t => t.to !== '/mock') : tools).map((tool) => (
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
      </section>

      <section className="dashboard-section" aria-labelledby="subjects-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">THE SIX PhLE MODULES</span>
            <h2 id="subjects-title">Your Pharmacy subjects, at a glance</h2>
          </div>
          <Link className="section-link" to="/analytics">
            Detailed analytics <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="dashboard-bottom-grid">
          <div className="subject-panel">
            <div className="panel-title">
              <div>
                <h3>PhLE Module Performance</h3>
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
                    subjectStats.map((s) => {
                      const detail = getSubjectDetail(s.subject)
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
                          <td>{s.total === 0 ? '—' : `${s.percent}%`}</td>
                          <td>
                            {s.total === 0 ? (
                              <Badge size="sm">No data yet</Badge>
                            ) : (
                              <Badge variant={s.weak ? 'warning' : 'success'} size="sm" dot>
                                {s.weak ? 'Needs focus' : 'On track'}
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="focus-panel">
            <span className="focus-icon">
              <Icon name="target" size={20} />
            </span>
            <span className="section-kicker">YOUR NEXT FOCUS</span>
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
                    <strong>{s.percent}%</strong>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/practice">
              {attempts.length ? 'Practice a Pharmacy module' : 'Start your first session'}{' '}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>
      <div className="dashboard-endnote">
        <span>YOUR JOURNEY TO RPh, ONE DAY AT A TIME.</span>
        <span>LISENSYNC AI / BS PHARMACY</span>
      </div>
    </div>
  )
}
