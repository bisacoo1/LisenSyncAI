import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { AnimatedNumber, Icon, Reveal, type IconName } from '@/components/ui'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { PASSING_RATE, type StudyTrack } from '@/types'
import { supabase, supabaseConfigured } from '@/lib/supabase'

interface MethodStep {
  number: string
  icon: IconName
  title: string
  description: string
  note: string
}

interface TrackContent {
  /** Label shown on the hero mode switch. */
  switchLabel: string
  switchHint: string
  eyebrow: string
  headline: { before: string; accent: string }
  description: string
  primaryCta: string
  secondaryCta: string
  secondaryHref: string
  footnote: ReactNode
  announcement: string
  announcementRight: string
  routeIntro: [string, string]
  routeSteps: string[]
  steps: MethodStep[]
}

const TRACKS: Record<StudyTrack, TrackContent> = {
  board: {
    switchLabel: 'Board exam',
    switchHint: 'PhLE candidate',
    eyebrow: 'BS PHARMACY · PRC PhLE COMPANION',
    headline: { before: 'Your RPh chapter starts with a', accent: 'good study day.' },
    description:
      'Turn pharmacy handouts into active-recall flashcards, clinical case drills, and timed mock exams mapped to all 6 PRC board modules.',
    primaryCta: 'Start PhLE review',
    secondaryCta: 'See all 6 modules',
    secondaryHref: '#syllabus',
    footnote: (
      <>
        For the late pharmacology nights, small wins,
        <br />
        <strong>and the RPh license at the end.</strong>
      </>
    ),
    announcement: 'THE BS PHARMACY STUDY SPACE · BUILT FOR THE PRC PhLE',
    announcementRight: 'ALL 06 BOARD MODULES IN ONE PLACE',
    routeIntro: ['FROM NOTES', 'TO LICENSED RPh'],
    routeSteps: ['UPLOAD PHARMACY NOTES', 'DRILL CLINICAL CASES', 'TRACK ALL 6 MODULES'],
    steps: [
      {
        number: '01',
        icon: 'upload',
        title: 'Bring your pharmacy notes',
        description:
          'Upload your lecture decks, drug monographs, and review handouts organized by PhLE board module.',
        note: 'PDF · DOCX · PPT',
      },
      {
        number: '02',
        icon: 'brain',
        title: 'Master drugs & clinical cases',
        description:
          'Build recall with flashcards, PhLE situational MCQs, clinical diagnosis, and dispensing priority drills.',
        note: 'ACTIVE RECALL',
      },
      {
        number: '03',
        icon: 'target',
        title: 'Simulate board exam day',
        description:
          'Take a timed 6-module PhLE mock exam aligned to the PRC Table of Specifications and find weak spots early.',
        note: 'TOS-ALIGNED MOCK',
      },
    ],
  },
  course: {
    switchLabel: 'Course mode',
    switchHint: 'BS Pharmacy student',
    eyebrow: 'BS PHARMACY · COURSE MODE COMPANION',
    headline: { before: 'Every course subject,', accent: 'ready before the exam.' },
    description:
      'Upload lecture notes and reviewers. Pharmora turns each BS Pharmacy subject into flashcards, MCQs, identification, and enumeration practice.',
    primaryCta: 'Start course mode',
    secondaryCta: 'See the course study tools',
    secondaryHref: '#study-tracks',
    footnote: (
      <>
        Built for the semesters before the boards,
        <br />
        <strong>so exam day already feels familiar.</strong>
      </>
    ),
    announcement: 'THE BS PHARMACY STUDY SPACE · BUILT FOR COURSEWORK TOO',
    announcementRight: 'YOUR OWN SUBJECTS, YOUR OWN STUDY SETS',
    routeIntro: ['FROM LECTURE', 'TO EXAM READY'],
    routeSteps: ['UPLOAD LECTURE NOTES', 'AUTO-BUILD 4 STUDY SETS', 'TRACK SUBJECT ACCURACY'],
    steps: [
      {
        number: '01',
        icon: 'upload',
        title: 'Upload a course reviewer',
        description:
          'Add your lecture deck, lab manual, or handout for any BS Pharmacy subject — one folder per course.',
        note: 'PDF · DOCX · PPT',
      },
      {
        number: '02',
        icon: 'list-checks',
        title: 'Get four study sets at once',
        description:
          'Saving a reviewer automatically generates flashcards, multiple-choice, enumeration, and identification practice.',
        note: 'AUTO-GENERATED',
      },
      {
        number: '03',
        icon: 'bar-chart',
        title: 'See each subject clearly',
        description:
          'Track accuracy per course subject and spot the topics to revisit before your next class exam.',
        note: 'SUBJECT ANALYTICS',
      },
    ],
  },
}

interface StudyTrackCard {
  id: StudyTrack
  index: string
  title: string
  audience: string
  icon: IconName
  description: string
  modes: { label: string; icon: IconName }[]
  bullets: string[]
  cta: string
  to: string
}

const STUDY_TRACKS: StudyTrackCard[] = [
  {
    id: 'board',
    index: 'TRACK 01',
    title: 'Board exam mode',
    audience: 'For PhLE candidates',
    icon: 'flag',
    description:
      'Everything maps to the PRC Pharmacist Licensure Examination so every review hour counts toward the 75% passing mark.',
    modes: [
      { label: 'Flashcards', icon: 'book-open' },
      { label: 'MCQ', icon: 'file-text' },
      { label: 'Diagnosis', icon: 'brain' },
      { label: 'Sequence', icon: 'chevron-up-down' },
    ],
    bullets: [
      'All 6 official PhLE modules with TOS weights',
      'Situational MCQs with step-by-step rationales',
      'Timed 660-minute, two-day mock simulation',
      'Readiness analytics against the 75% benchmark',
    ],
    cta: 'Start board review',
    to: '/register?track=board',
  },
  {
    id: 'course',
    index: 'TRACK 02',
    title: 'Course mode',
    audience: 'For BS Pharmacy students',
    icon: 'book-open',
    description:
      'Still in your BS Pharmacy units? Name your own subjects and let each uploaded reviewer become a complete practice set.',
    modes: [
      { label: 'Flashcards', icon: 'book-open' },
      { label: 'MCQ', icon: 'file-text' },
      { label: 'Identification', icon: 'search' },
      { label: 'Enumeration', icon: 'list-checks' },
    ],
    bullets: [
      'Your own subject list — no fixed board modules',
      'Saving a reviewer builds all four study sets',
      'Per-subject practice accuracy and focus areas',
      'No mock exam timer until you actually need it',
    ],
    cta: 'Start course mode',
    to: '/register?track=course',
  },
]

const FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: 'What is the difference between board exam mode and course mode?',
    answer: (
      <>
        <strong>Board exam mode</strong> is built around the 6 official PRC PhLE modules, the Table of Specifications,
        clinical diagnosis and sequence drills, and a timed 660-minute mock exam.{' '}
        <strong>Course mode</strong> is for students still taking BS Pharmacy: you name your own subjects, and every
        reviewer you save becomes flashcards, multiple-choice, identification, and enumeration sets.
      </>
    ),
  },
  {
    question: 'Can I switch between the two modes later?',
    answer: (
      <>
        Yes. Your study mode is saved on your profile, and you can change it at any time — nothing you have uploaded or
        practiced is lost.
      </>
    ),
  },
  {
    question: 'What file types can I upload?',
    answer: (
      <>
        PDF, DOCX, and presentation decks. Text is extracted in your browser, so scanned, image-only PDFs may yield
        limited material to work from.
      </>
    ),
  },
  {
    question: 'Does course mode still use the 75% passing benchmark?',
    answer: (
      <>
        The 75% benchmark is a PhLE target. In course mode you are measured against your own practice average, and each
        subject is flagged when it falls below it.
      </>
    ),
  },
  {
    question: 'Do I need an AI key to generate practice sets?',
    answer: (
      <>
        Generation uses the assistant configured for the app. If it is not configured, the workspace still loads and
        saves your reviewers — only the generate actions stop and show a configuration notice.
      </>
    ),
  },
]

const examSpecs: { value: number; suffix?: string; pad?: boolean; label: string }[] = [
  { value: PHARMACY_PROGRAM.subjectDetails.length, pad: true, label: 'PhLE modules' },
  { value: PHARMACY_PROGRAM.mockDurationMinutes, suffix: 'm', label: 'Mock simulation' },
  { value: PASSING_RATE, suffix: '%', label: 'PRC pass mark' },
]

function HeadlineWords({ text, offset = 0 }: { text: string; offset?: number }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${offset}-${index}`}>
          <span
            className="hero-headline-word"
            style={{ animationDelay: `${260 + (offset + index) * 42}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  )
}

export default function LandingPage() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<{ label: string; value: number; icon: IconName }[] | null>(null)
  const [track, setTrack] = useState<StudyTrack>('board')

  const copy = useMemo(() => TRACKS[track], [track])

  useEffect(() => {
    if (loading) return
    if (profile) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (!supabaseConfigured) return

    setStats(null)
    let active = true
    // These counts are constrained by the project's RLS policies. Don't present
    // unavailable or entirely hidden counts as community-wide statistics.
    ;(async () => {
      try {
        const [profiles, materials, mocks, items] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('review_materials').select('id', { count: 'exact', head: true }),
          supabase.from('mock_exams').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
          supabase.from('practice_items').select('id', { count: 'exact', head: true })
        ])
        const results = [profiles, materials, mocks, items]
        if (!active || results.some((result) => result.error || result.count == null)) return
        if (!results.some((result) => (result.count ?? 0) > 0)) return
        setStats([
          { label: 'Pharmacy learners', value: profiles.count!, icon: 'user' },
          { label: 'Review materials', value: materials.count!, icon: 'file-text' },
          { label: 'Practice items', value: items.count!, icon: 'book-open' },
          { label: 'Mock exams completed', value: mocks.count!, icon: 'timer' }
        ])
      } catch {
        // The landing page stays useful when analytics aren't publicly available.
      }
    })()
    return () => {
      active = false
    }
  }, [loading, profile, navigate])

  const registerHref = track === 'course' ? '/register?track=course' : '/register'

  return (
    <div className="landing">
      <div className="landing-announcement">
        <div className="landing-wrap announcement-inner">
          <span>
            {copy.announcement}
          </span>
          <span className="announcement-right">
            {copy.announcementRight} <Icon name="arrow-up-right" size={13} />
          </span>
        </div>
      </div>

      <header className="landing-header liquid-glass-strong">
        <div className="landing-wrap landing-nav">
          <Brand />
          <nav className="landing-nav-links" aria-label="Page navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#study-tracks">Study modes</a>
            <a href="#syllabus">PhLE Syllabus</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-sign-in">
              Sign in
            </Link>
            <Link to={registerHref} className="landing-nav-button">
              Get started <Icon name="arrow-up-right" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main aria-label="Pharmora AI study platform" tabIndex={-1} data-route-main>
        <section className="landing-hero landing-wrap">
          <div className="landing-hero-copy">
            <div className="landing-mode-switch liquid-glass" role="group" aria-label="Choose your study mode">
              <span className="landing-mode-switch-label">STUDY MODE</span>
              {(Object.keys(TRACKS) as StudyTrack[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`landing-mode-option${track === key ? ' is-active' : ''}`}
                  aria-pressed={track === key}
                  onClick={() => setTrack(key)}
                >
                  <Icon name={key === 'board' ? 'flag' : 'book-open'} size={15} />
                  <span className="landing-mode-option-copy">
                    <strong>{TRACKS[key].switchLabel}</strong>
                    <small>{TRACKS[key].switchHint}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="landing-eyebrow">
              <span className="eyebrow-dot" /> {copy.eyebrow} <span className="eyebrow-index">/ 01</span>
            </div>
            <h1>
              <HeadlineWords text={copy.headline.before} />
              {' '}
              <em>
                <HeadlineWords text={copy.headline.accent} offset={copy.headline.before.split(' ').length} />
              </em>
            </h1>
            <p>{copy.description}</p>
            <div className="landing-hero-actions">
              <Link to={registerHref} className="landing-primary-button liquid-glass-strong">
                {copy.primaryCta} <Icon name="arrow-right" size={19} />
              </Link>
              <a href={copy.secondaryHref} className="landing-text-link">
                {copy.secondaryCta} <Icon name="arrow-down" size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span className="hero-footnote-icon">
                <Icon name={track === 'course' ? 'graduation-cap' : 'pill'} size={17} />
              </span>
              <span>{copy.footnote}</span>
            </div>
          </div>

        </section>

        <Reveal as="section" className="landing-route" aria-label="Your Pharmacy study journey">
          <div className="landing-wrap landing-route-inner">
            <div className="route-intro">
              <Icon name={track === 'course' ? 'book-open' : 'pill'} size={18} />
              <span>
                {copy.routeIntro[0]}
                <br />
                <strong>{copy.routeIntro[1]}</strong>
              </span>
            </div>
            {copy.routeSteps.map((step, index) => (
              <div className="route-step" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span> {step}
              </div>
            ))}
            <a className="route-end" href={registerHref} aria-label={`Get started with ${copy.switchLabel.toLowerCase()}`}>
              <Icon name="arrow-up-right" size={18} />
            </a>
          </div>
        </Reveal>

        <Reveal as="section" id="how-it-works" className="landing-method landing-wrap">
          <div className="section-intro">
            <div>
              <span className="section-kicker">
                THE METHOD <span> / 01</span>
              </span>
              <h2>
                {track === 'course' ? (
                  <>
                    Any course subject.
                    <br />
                    <em>Four ways to review it.</em>
                  </>
                ) : (
                  <>
                    Six PhLE modules.
                    <br />
                    <em>Small, steady steps.</em>
                  </>
                )}
              </h2>
            </div>
            <p>
              {track === 'course'
                ? 'Your BS Pharmacy coursework is dense. Pharmora turns each reviewer into a calm set of study modes so you can review by recall, by question, by term, or by list.'
                : 'Preparing for the Pharmacist Licensure Examination takes focus. Pharmora helps you turn dense Pharmacy reviewers into a calm, consistent daily rhythm.'}
            </p>
          </div>
          <Reveal className="method-grid motion-stagger" id="study-tools">
            {copy.steps.map((step) => (
              <article className="method-card liquid-glass" key={step.number}>
                <div className="method-card-top">
                  <span className="method-icon">
                    <Icon name={step.icon} size={23} />
                  </span>
                  <span>{step.number} / 03</span>
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                <div className="method-card-foot">
                  <span>{step.note}</span>
                  <Icon name="arrow-up-right" size={16} />
                </div>
              </article>
            ))}
          </Reveal>
        </Reveal>

        {stats && (
          <Reveal as="section" className="landing-activity" aria-labelledby="landing-activity-title">
            <div className="landing-wrap landing-activity-inner">
              <div className="landing-activity-intro">
                <span className="section-kicker">THE PHARMACY STUDY SPACE · LIVE</span>
                <h2 id="landing-activity-title">
                  A little progress, <em>together.</em>
                </h2>
                <p>Live activity visible to this connection.</p>
              </div>
              <Reveal className="landing-activity-grid motion-stagger">
                {stats.map((stat) => (
                  <div className="landing-activity-stat" key={stat.label}>
                    <Icon name={stat.icon} size={18} />
                    <strong>
                      <AnimatedNumber value={stat.value} startOnView duration={1200} delay={80} />
                    </strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </Reveal>
            </div>
          </Reveal>
        )}

        <Reveal as="section" id="study-tracks" className="landing-tracks landing-wrap">
          <div className="section-intro section-intro--wide">
            <div>
              <span className="section-kicker">
                TWO WAYS TO STUDY <span> / 02</span>
              </span>
              <h2>
                Choose the mode that
                <br />
                <em>matches your semester.</em>
              </h2>
            </div>
            <p>
              Candidates reviewing for the boards and students still in coursework need different tools. Pick a study
              mode now — it is saved to your profile and can be changed any time.
            </p>
          </div>
          <Reveal className="track-grid motion-stagger">
            {STUDY_TRACKS.map((item) => (
              <article
                className={`track-card liquid-glass${track === item.id ? ' is-selected' : ''}`}
                key={item.id}
                aria-current={track === item.id ? 'true' : undefined}
              >
                <div className="track-card-top">
                  <span className="track-card-icon">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="track-card-index">{item.index}</span>
                </div>
                <span className="track-card-audience">{item.audience}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="track-mode-chips" aria-label={`${item.title} study modes`}>
                  {item.modes.map((mode) => (
                    <span className="track-mode-chip" key={mode.label}>
                      <Icon name={mode.icon} size={13} /> {mode.label}
                    </span>
                  ))}
                </div>
                <ul className="track-card-list">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>
                      <Icon name="check-circle" size={15} /> <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="track-card-actions">
                  <Link to={item.to} className="track-card-cta">
                    {item.cta} <Icon name="arrow-right" size={16} />
                  </Link>
                  <button
                    type="button"
                    className="track-card-select"
                    aria-pressed={track === item.id}
                    onClick={() => setTrack(item.id)}
                  >
                    {track === item.id ? 'Previewing' : 'Preview on this page'}
                  </button>
                </div>
              </article>
            ))}
          </Reveal>
        </Reveal>

        <Reveal as="section" id="syllabus" className="landing-programs">
          <div className="landing-wrap programs-layout">
            <div className="programs-copy">
              <span className="section-kicker">
                THE PhLE SYLLABUS <span> / 03</span>
              </span>
              <h2>
                Built for all six
                <br />
                <em>Pharmacy modules.</em>
              </h2>
              <p>
                Every reviewer upload, flashcard deck, clinical diagnosis drill, and mock exam maps directly to the PRC
                Pharmacist Licensure Examination Table of Specifications—so every study hour moves your readiness
                forward.
              </p>
              <div className="course-mode-note">
                <Icon name="book-open" size={17} />
                <span>
                  <strong>In course mode</strong> these six modules are replaced by the subjects you create yourself.
                </span>
              </div>
              <div className="syllabus-spec-row" aria-label="Pharmacist Licensure Examination overview">
                {examSpecs.map((spec) => (
                  <div className="syllabus-spec-item" key={spec.label}>
                    <strong>
                      <AnimatedNumber
                        value={spec.value}
                        suffix={spec.suffix}
                        startOnView
                        duration={1100}
                        delay={120}
                        format={spec.pad ? (n) => String(Math.round(n)).padStart(2, '0') : undefined}
                      />
                    </strong>
                    <span>{spec.label}</span>
                  </div>
                ))}
              </div>
              <Link to="/register" className="programs-link">
                Start your Pharmacy review <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <Reveal className="program-list motion-stagger">
              <div className="program-list-heading">
                <span>BS PHARMACY · PRC PhLE MODULES</span>
                <span>0{PHARMACY_PROGRAM.subjectDetails.length} MODULES · 100% TOS</span>
              </div>
              {PHARMACY_PROGRAM.subjectDetails.map((mod) => (
                <div className="program-row program-row--module" key={mod.name}>
                  <span className="program-number">{mod.moduleNumber}</span>
                  <span className="program-icon">
                    <Icon name={mod.icon} size={19} />
                  </span>
                  <span className="program-name">
                    <small>{mod.moduleCode.toUpperCase()}</small>
                    <strong>{mod.name}</strong>
                    <span className="program-desc">{mod.description}</span>
                    <span className="module-tos-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, mod.weightPercent * 4.5)}%` }} />
                    </span>
                  </span>
                  <span className="program-weight" aria-label={`${mod.weightPercent} percent exam weight`}>
                    <AnimatedNumber value={mod.weightPercent} suffix="%" startOnView duration={1000} delay={120} />
                  </span>
                </div>
              ))}
            </Reveal>
          </div>
        </Reveal>

        <Reveal as="section" id="faq" className="landing-faq landing-wrap">
          <div className="section-intro section-intro--wide">
            <div>
              <span className="section-kicker">
                QUESTIONS <span> / 04</span>
              </span>
              <h2>
                The details, <em>up front.</em>
              </h2>
            </div>
            <p>Still deciding which mode fits? Here is how Pharmora handles both.</p>
          </div>
          <div className="faq-list">
            {FAQS.map((item) => (
              <details className="faq-item liquid-glass" key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <Icon name="chevron-down" size={18} />
                </summary>
                <div className="faq-answer">{item.answer}</div>
              </details>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="landing-cta landing-wrap">
          <div className="cta-star">
            <Icon name={track === 'course' ? 'graduation-cap' : 'pill'} size={23} />
          </div>
          <div>
            <span className="section-kicker">
              {track === 'course' ? 'COURSE MODE IS READY' : 'YOUR RPh CHAPTER IS WAITING'}
            </span>
            <h2>{track === 'course' ? 'Every subject, ready.' : 'Ready when you are.'}</h2>
            <p>
              {track === 'course'
                ? 'Create an account and turn your first BS Pharmacy reviewer into four study sets.'
                : 'Make today a good day to begin your BS Pharmacy review.'}
            </p>
          </div>
          <Link to={registerHref} className="landing-primary-button liquid-glass-strong">
            Create your account <Icon name="arrow-right" size={19} />
          </Link>
        </Reveal>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <Brand />
          <p>Made for BS Pharmacy students and candidates on the journey to RPh.</p>
          <div>
            <a href="#study-tracks">Study modes</a>
            <Link to="/login">Sign in</Link>
            <Link to={registerHref}>Get started</Link>
            <span>© {new Date().getFullYear()} Pharmora AI</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
