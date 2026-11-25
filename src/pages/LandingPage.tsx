import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Leaf,
  Menu,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Upload,
  X,
} from 'lucide-react'
import { Brand } from '@/components/Brand'
import { StudyPreview } from '@/components/StudyPreview'
import { useAuth } from '@/context/AuthContext'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import type { StudyTrack } from '@/types'
import lilo from '@/assets/mascot/mascot-avatar-512.png'

const subjectIcons = [
  FlaskConical,
  Leaf,
  Stethoscope,
  HeartPulse,
  Pill,
  ShieldCheck,
]
const faqs = [
  {
    question: 'Is Pharmora for students or board exam takers?',
    answer:
      'Both. Choose Course mode to organize your own BS Pharmacy subjects, or Board exam mode for review across the six Pharmacist Licensure Examination (PhLE) modules. Choose your starting mode when you create an account.',
  },
  {
    question: 'Can I use my own lecture notes and reviewers?',
    answer:
      'Yes. Upload your supported study documents or photos, or paste your notes. Pharmora uses your material to build study sets, so you can practice the topics you’re actually learning.',
  },
  {
    question: 'How does the AI study companion help?',
    answer:
      'Lilo can explain concepts, help you work through questions, and read study explanations aloud. AI can make mistakes, so always check important information against your course materials and authoritative pharmacy references.',
  },
  {
    question: 'What can I practice for the PhLE?',
    answer:
      'Board exam mode includes flashcards, multiple-choice questions, clinical diagnosis and sequence practice, plus timed mock exams. Your progress helps you identify topics to revisit across all six modules.',
  },
  {
    question: 'Can I study on my phone?',
    answer:
      'Yes. Pharmora works in your browser on mobile, tablet, and desktop. Sign in to your account to keep your study materials and progress together.',
  },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [track, setTrack] = useState<StudyTrack>('board')
  const [menuOpen, setMenuOpen] = useState(false)
  const registerHref = user ? '/dashboard' : `/register?track=${track}`

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        document.getElementById('public-menu-toggle')?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div className="public-site">
      <a href="#main-content" className="public-skip">
        Skip to content
      </a>
      <header className="public-header">
        <div className="public-wrap public-header-inner">
          <Brand />
          <nav className="public-desktop-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#subjects">Study subjects</a>
            <a href="#meet-lilo">
              Meet Lilo <span className="public-new">AI tutor</span>
            </a>
          </nav>
          <div className="public-header-actions">
            <Link
              className="public-login-link"
              to={user ? '/dashboard' : '/login'}
            >
              {user ? 'My workspace' : 'Log in'}
            </Link>
            <Link
              className="public-button public-button--small"
              to={registerHref}
            >
              {user ? 'Keep learning' : 'Get started'}
              <ArrowRight size={16} />
            </Link>
            <button
              id="public-menu-toggle"
              type="button"
              className="public-menu-toggle"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <nav
          id="public-mobile-nav"
          className="public-mobile-nav"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#subjects" onClick={() => setMenuOpen(false)}>
            Study subjects
          </a>
          <a href="#meet-lilo" onClick={() => setMenuOpen(false)}>
            Meet Lilo
          </a>
          <Link to="/login">Log in</Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} data-route-main>
        <section
          className="public-hero public-wrap"
          aria-labelledby="hero-title"
        >
          <div className="public-hero-copy">
            <span className="public-pill">
              <span className="public-status-dot" /> A smarter study space for
              future pharmacists
            </span>
            <h1 id="hero-title">
              Less cramming.
              <br />
              More confidence.
              <br />
              Your RPh awaits.
            </h1>
            <p>
              Your notes, your practice, your progress. Turn what you’re
              learning into knowledge that stays—with a little help from AI.
            </p>
            <div
              className="public-track-switch"
              role="group"
              aria-label="Choose your study mode"
            >
              <button
                type="button"
                aria-pressed={track === 'board'}
                onClick={() => setTrack('board')}
              >
                <Target size={16} />
                PhLE board review
              </button>
              <button
                type="button"
                aria-pressed={track === 'course'}
                onClick={() => setTrack('course')}
              >
                <GraduationCap size={18} />
                BS Pharmacy courses
              </button>
            </div>
            <div className="public-hero-actions">
              <Link className="public-button" to={registerHref}>
                {user
                  ? 'Go to my workspace'
                  : track === 'board'
                    ? 'Start my PhLE review'
                    : 'Start my course review'}
                <ArrowRight size={18} />
              </Link>
              <a className="public-text-link" href="#how-it-works">
                See how it works <ArrowDown size={16} />
              </a>
            </div>
            <div className="public-hero-reassurance">
              <span>
                <Check size={15} /> Your own study materials
              </span>
              <span>
                <Check size={15} /> Learn at your pace
              </span>
            </div>
          </div>
          <div className="public-hero-visual">
            <div className="public-preview-note">
              <Sparkles size={15} /> A little practice. A lot more possibility.
            </div>
            <StudyPreview track={track} />
            <div className="public-lilo-note">
              <img src={lilo} alt="Lilo, your owl study companion" />
              <div>
                <strong>Big goals. Small study wins.</strong>
                <span>I’m Lilo. Let’s figure it out together.</span>
              </div>
              <span className="public-lilo-sparkle">
                <Sparkles size={19} />
              </span>
            </div>
          </div>
        </section>
        <section className="public-proof" aria-label="Study tools">
          <div className="public-wrap">
            <p>Built around the way pharmacy students learn.</p>
            <div className="public-proof-tools">
              <span>
                <BookOpen />
                Active recall
              </span>
              <span>
                <BrainCircuit />
                AI-powered practice
              </span>
              <span>
                <Target />6 PhLE modules
              </span>
              <span>
                <ChartNoAxesCombined />
                Progress you can see
              </span>
            </div>
          </div>
        </section>
        <section
          className="public-section public-wrap"
          id="how-it-works"
          aria-labelledby="method-title"
        >
          <div className="public-section-heading">
            <span className="public-section-label">
              Less busywork. More learning.
            </span>
            <h2 id="method-title">
              From a pile of notes to
              <br />
              “I actually know this.”
            </h2>
            <p>One connected workspace. A simpler way to prepare.</p>
          </div>
          <div className="public-steps">
            {[
              {
                icon: Upload,
                title: 'Bring what you’re learning',
                copy: 'Upload your lecture notes, handouts, or reviewers. Keep your study materials organized by subject.',
                note: 'Your materials, all together',
              },
              {
                icon: BrainCircuit,
                title: 'Make it stick with practice',
                copy: 'Turn your materials into flashcards and questions. Get clear explanations that help the concepts click.',
                note: 'Active recall, not endless rereading',
              },
              {
                icon: ChartNoAxesCombined,
                title: 'Know what to study next',
                copy: 'See how you’re doing, revisit tricky topics, and build your confidence one study session at a time.',
                note: 'Progress that points you forward',
              },
            ].map(({ icon: StepIcon, title, copy, note }, index) => (
              <article className="public-step" key={title}>
                <div
                  className={`public-step-art public-step-art--${index + 1}`}
                >
                  <StepIcon size={35} strokeWidth={1.6} />
                  <span>{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="public-step-note">
                  <Check size={14} />
                  {note}
                </span>
              </article>
            ))}
          </div>
        </section>
        <section
          className="public-subject-section"
          id="subjects"
          aria-labelledby="subjects-title"
        >
          <div className="public-wrap public-section">
            <div className="public-subject-heading">
              <div>
                <span className="public-section-label">
                  Your syllabus. A clearer path.
                </span>
                <h2 id="subjects-title">
                  Big pharmacy goals.
                  <br />
                  Every subject covered.
                </h2>
              </div>
              <p>
                Preparing for the boards? Focus your review across all six PhLE
                modules. Still in school? Build a study space for your own
                subjects.
              </p>
            </div>
            <div className="public-subject-grid">
              {PHARMACY_PROGRAM.subjectDetails.map((subject, index) => {
                const SubjectIcon = subjectIcons[index]
                return (
                  <Link
                    to={user ? '/dashboard' : '/register?track=board'}
                    className="public-subject-card"
                    key={subject.name}
                  >
                    <div>
                      <span
                        className={`public-subject-icon public-subject-icon--${index}`}
                      >
                        <SubjectIcon size={23} />
                      </span>
                      <span className="public-module-label">
                        Module {index + 1}
                      </span>
                    </div>
                    <h3>{subject.name}</h3>
                    <p>{subject.description}</p>
                    <span className="public-subject-link">
                      Explore this subject <ArrowRight size={16} />
                    </span>
                  </Link>
                )
              })}
            </div>
            <div className="public-course-callout">
              <span>
                <GraduationCap size={21} /> Still working through your BS
                Pharmacy courses?
              </span>
              <Link to={user ? '/dashboard' : '/register?track=course'}>
                Try Course mode <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <section
          id="meet-lilo"
          className="public-tutor public-wrap public-section"
          aria-labelledby="tutor-title"
        >
          <div className="public-tutor-art">
            <span className="public-tutor-orbit" />
            <span className="public-tutor-bubble">
              Let’s make that concept click. <Sparkles size={17} />
            </span>
            <img
              src={lilo}
              alt="Lilo, Pharmora’s friendly owl tutor"
              loading="lazy"
            />
            <span className="public-audio-chip">
              <AudioLines size={24} />
              <span>Read it. Hear it. Understand it.</span>
            </span>
          </div>
          <div className="public-tutor-copy">
            <span className="public-section-label">
              <Sparkles size={16} /> Meet your study sidekick
            </span>
            <h2 id="tutor-title">
              A tricky topic?
              <br />
              You’re not on your own.
            </h2>
            <p>
              Meet Lilo, your AI study companion. Ask for a simpler explanation,
              work through a practice question, or listen to a concept out loud.
            </p>
            <ul>
              <li>
                <Check size={17} /> Clear explanations, without the overwhelm
              </li>
              <li>
                <Check size={17} /> Help grounded in your study materials
              </li>
              <li>
                <Check size={17} /> A friendly voice for your review sessions
              </li>
            </ul>
            <Link
              to={registerHref}
              className="public-button public-button--outline"
            >
              Study with Lilo <ArrowRight size={17} />
            </Link>
            <small>
              AI supports your learning. Always verify clinical information.
            </small>
          </div>
        </section>
        <section className="public-faq-section">
          <div className="public-wrap public-faq">
            <div>
              <span className="public-section-label">
                A little more clarity
              </span>
              <h2>
                Good questions.
                <br />
                Straight answers.
              </h2>
              <p>Getting to know your new study space.</p>
            </div>
            <div className="public-faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <ChevronDown size={19} />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="public-final-cta public-wrap">
          <span className="public-pill">
            <GraduationCap size={16} /> For your next exam. And what comes
            after.
          </span>
          <h2>
            A little more ready.
            <br />
            Every single day.
          </h2>
          <p>Your future in pharmacy starts with what you learn today.</p>
          <Link to={registerHref} className="public-button">
            {user ? 'Back to my workspace' : 'Create my account'}
            <ArrowRight size={18} />
          </Link>
          <span className="public-cta-footnote">
            Your notes. Your pace. Your Pharmora.
          </span>
        </section>
      </main>
      <footer className="public-footer">
        <div className="public-wrap">
          <div className="public-footer-top">
            <div>
              <Brand />
              <p>
                A little less overwhelmed.
                <br />A lot more prepared.
              </p>
            </div>
            <nav aria-label="Footer navigation">
              <a href="#how-it-works">How it works</a>
              <a href="#subjects">Study subjects</a>
              <a href="#meet-lilo">Meet Lilo</a>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </nav>
          </div>
          <div className="public-footer-bottom">
            <span>© {new Date().getFullYear()} Pharmora AI</span>
            <span>Made for BS Pharmacy students and future RPhs.</span>
            <span>Independent study tool. Not affiliated with the PRC.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
