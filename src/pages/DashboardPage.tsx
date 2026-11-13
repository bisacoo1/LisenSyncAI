import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getProgram } from '@/lib/syllabus'
import { supabase } from '@/lib/supabase'
import { computeSubjectStats, overallPercent, readinessLabel } from '@/lib/analytics'
import { PASSING_RATE, type Attempt } from '@/types'
import { Badge, Button, Icon, ProgressBar, Skeleton, useToast, type IconName } from '@/components/ui'

const tools: { number: string; icon: IconName; title: string; description: string; action: string; to: string }[] = [
  {
    number: '01',
    icon: 'upload',
    title: 'Make your study set',
    description: 'Turn your review materials into flashcards and drills.',
    action: 'Add a reviewer',
    to: '/reviewer'
  },
  {
    number: '02',
    icon: 'brain',
    title: 'Put it into practice',
    description: 'Recall, apply, and build on what you know.',
    action: 'Start practicing',
    to: '/practice'
  },
  {
    number: '03',
    icon: 'timer',
    title: 'Try the real thing',
    description: 'Get exam-day ready with a timed simulation.',
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
  const [loading, setLoading] = useState(true)
  const [examDateInput, setExamDateInput] = useState('')
  const [savingDate, setSavingDate] = useState(false)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase.from('attempts').select('*').eq('user_id', profile.id).limit(500)
      setAttempts((data as Attempt[]) || [])
      const { count } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .lte('next_review_at', new Date().toISOString())
      setDueCards(count || 0)
      setLoading(false)
    })()
  }, [profile?.id])

  if (!profile || !program) return null

  const overall = overallPercent(attempts)
  const readiness = readinessLabel(overall)
  const subjectStats = computeSubjectStats(attempts, program.subjects)
  const weak = subjectStats.filter((s) => s.weak && s.total > 0)
  const firstName = profile.full_name?.trim().split(/\s+/)[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const examDate = profile.target_exam_date ? new Date(`${profile.target_exam_date}T00:00:00`) : null
  const daysLeft = examDate ? Math.round((examDate.getTime() - today.getTime()) / 86400000) : null
  const dailyCompleted =
    profile.daily_goal_date === new Date().toISOString().slice(0, 10) ? profile.daily_items_completed || 0 : 0
  const dailyGoal = profile.daily_goal || 20

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
            <span className="eyebrow-dot" /> YOUR STUDY OVERVIEW <span>/ 01</span>
          </div>
          <h1>
            A good day to <em>make progress.</em>
          </h1>
          <p>{firstName ? `Welcome back, ${firstName}. ` : 'Welcome back. '}Here's where your review stands.</p>
        </div>
        <Link to="/practice" className="workspace-primary-link">
          Continue studying <Icon name="arrow-right" size={17} />
        </Link>
      </header>

      <div className="dashboard-feature-grid">
        <section className="readiness-panel" aria-labelledby="readiness-title">
          <div className="readiness-topline">
            <span>
              <Icon name="sparkles" size={16} /> YOUR READINESS
            </span>
            <span>THE BIG PICTURE / 01</span>
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
                    ? 'Your progress starts with your first practice session.'
                    : overall >= PASSING_RATE
                      ? 'You are on track. Keep that momentum going.'
                      : `${readiness.label}. Every practice session gets you closer.`}
              </p>
            </div>
            <div
              className="readiness-orbit"
              style={{ background: `conic-gradient(#d3e9a0 ${Math.min(overall, 100)}%, rgba(255,255,255,.12) 0)` }}
              aria-label={
                loading
                  ? 'Loading practice score'
                  : attempts.length
                    ? `Overall score ${overall} percent, benchmark ${PASSING_RATE} percent`
                    : `No practice score yet; benchmark ${PASSING_RATE} percent`
              }
            >
              <div>
                <Icon name="target" size={20} />
                <strong>{PASSING_RATE}%</strong>
                <span>YOUR TARGET</span>
              </div>
            </div>
          </div>
          <div className="readiness-progress-label">
            <span>{attempts.length ? `${overall}% overall` : 'Your starting point'}</span>
            <span>PRC BENCHMARK {PASSING_RATE}%</span>
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
              <strong>{program.subjects.length}</strong> board subjects
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
            <span>THE COUNTDOWN</span>
            <Icon name="arrow-up-right" size={17} />
          </div>
          <div className="countdown-content">
            <span className="countdown-overline">A DATE TO WORK TOWARDS</span>
            <h2 id="countdown-title">
              {daysLeft == null ? (
                'Your exam day.'
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
                ? 'Set your target date and make every study day count.'
                : daysLeft < 0
                  ? 'Your target date has passed. Set a new one to keep going.'
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
              <span className="momentum-icon mint">
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
              <span className="momentum-icon peach">
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
              <span className="momentum-icon lavender">
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
          <Link to="/practice?mode=flashcards" className="momentum-card momentum-card--link">
            <div className="momentum-card-top">
              <span className="momentum-icon yellow">
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
          {tools.map((tool) => (
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
            <span className="section-kicker">THE ROAD AHEAD</span>
            <h2 id="subjects-title">Your subjects, at a glance</h2>
          </div>
          <Link className="section-link" to="/analytics">
            Detailed analytics <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="dashboard-bottom-grid">
          <div className="subject-panel">
            <div className="panel-title">
              <div>
                <h3>Subject performance</h3>
                <p>{program.name}</p>
              </div>
              <Icon name="bar-chart" size={20} />
            </div>
            <div
              className="table-wrapper"
              role="region"
              aria-label="Subject performance, scrollable table"
              tabIndex={0}
            >
              <table className="table subject-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Attempts</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectStats.map((s) => (
                    <tr key={s.subject}>
                      <td>{s.subject}</td>
                      <td>{loading ? '—' : s.total}</td>
                      <td>{loading || s.total === 0 ? '—' : `${s.percent}%`}</td>
                      <td>
                        {loading ? (
                          <Skeleton variant="text" width={55} />
                        ) : s.total === 0 ? (
                          <Badge size="sm">No data yet</Badge>
                        ) : (
                          <Badge variant={s.weak ? 'warning' : 'success'} size="sm" dot>
                            {s.weak ? 'Needs focus' : 'On track'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
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
                    : 'Every journey starts somewhere.'}
            </h3>
            <p>
              {loading
                ? 'Your insights are on their way.'
                : weak.length
                  ? 'These subjects are below your 75% target. A little practice can go a long way.'
                  : attempts.length
                    ? 'No subjects are flagged right now. Keep building on your progress.'
                    : 'Complete a practice session to see which subjects need your attention.'}
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
              {attempts.length ? 'Practice a subject' : 'Start your first session'}{' '}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>
      <div className="dashboard-endnote">
        <span>YOUR JOURNEY, ONE DAY AT A TIME.</span>
        <span>LISENSYNC AI / STUDY SPACE</span>
      </div>
    </div>
  )
}
