import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { AnimatedNumber, Icon, Reveal, type IconName } from '@/components/ui'
import { PHARMACY_PROGRAM } from '@/lib/syllabus'
import { PASSING_RATE } from '@/types'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import pharmacyHero from '@/assets/pharmacy-hero.jpg'

const steps: { number: string; icon: IconName; title: string; description: string; note: string }[] = [
  {
    number: '01',
    icon: 'upload',
    title: 'Bring your pharmacy notes',
    description:
      'Upload your lecture decks, drug monographs, and review handouts organized by PhLE board module.',
    note: 'PDF · DOCX · PPT'
  },
  {
    number: '02',
    icon: 'brain',
    title: 'Master drugs & clinical cases',
    description:
      'Build recall with flashcards, PhLE situational MCQs, clinical diagnosis, and dispensing priority drills.',
    note: 'ACTIVE RECALL'
  },
  {
    number: '03',
    icon: 'target',
    title: 'Simulate board exam day',
    description:
      'Take a timed 6-module PhLE mock exam aligned to the PRC Table of Specifications and find weak spots early.',
    note: 'TOS-ALIGNED MOCK'
  }
]

const examSpecs: { value: number; suffix?: string; pad?: boolean; label: string }[] = [
  { value: PHARMACY_PROGRAM.subjectDetails.length, pad: true, label: 'PhLE modules' },
  { value: PHARMACY_PROGRAM.mockDurationMinutes, suffix: 'm', label: 'Mock simulation' },
  { value: PASSING_RATE, suffix: '%', label: 'PRC pass mark' }
]

export default function LandingPage() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<{ label: string; value: number; icon: IconName }[] | null>(null)

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

  return (
    <div className="landing">
      <div className="landing-announcement">
        <div className="landing-wrap announcement-inner">
          <span>
            THE BS PHARMACY STUDY SPACE <i /> BUILT FOR THE PRC PhLE
          </span>
          <span className="announcement-right">
            ALL 06 BOARD MODULES IN ONE PLACE <Icon name="arrow-up-right" size={13} />
          </span>
        </div>
      </div>

      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Brand />
          <nav className="landing-nav-links" aria-label="Page navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#study-tools">Study tools</a>
            <a href="#syllabus">PhLE Syllabus</a>
          </nav>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-sign-in">
              Sign in
            </Link>
            <Link to="/register" className="landing-nav-button">
              Get started <Icon name="arrow-up-right" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero landing-wrap">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="eyebrow-dot" /> BS PHARMACY · PRC PhLE COMPANION{' '}
              <span className="eyebrow-index">/ 01</span>
            </div>
            <h1>
              Your RPh chapter starts with a <em>good study day.</em>
            </h1>
            <p>
              Turn your BS Pharmacy handouts into active-recall flashcards, clinical case drills, and timed PhLE mock
              exams—aligned across all 6 PRC board modules.
            </p>
            <div className="landing-hero-actions">
              <Link to="/register" className="landing-primary-button">
                Start Pharmacy review <Icon name="arrow-right" size={19} />
              </Link>
              <a href="#syllabus" className="landing-text-link">
                Explore the 6 PhLE modules <Icon name="arrow-down" size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span className="hero-footnote-icon">
                <Icon name="pill" size={17} />
              </span>
              <span>
                For the late pharmacology nights, small wins,
                <br />
                <strong>and the RPh license at the end.</strong>
              </span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <img
              src={pharmacyHero}
              alt="A clinical pharmacy study desk with porcelain mortar and pestle, laboratory flasks, amber bottle, navy reference books, and open notebook"
            />
            <div className="hero-image-overlay" />
            <div className="hero-image-top">
              <span>
                <Icon name="flask" size={15} /> BS PHARMACY · PhLE
              </span>
              <span>06 MODULES / CLINICAL REVIEW</span>
            </div>
            <div className="hero-stamp" aria-label="75 percent PhLE passing benchmark">
              <span>PhLE GOAL</span>
              <strong>
                <AnimatedNumber value={PASSING_RATE} duration={1400} delay={420} startOnView />
                <small>%</small>
              </strong>
              <span>PASSING BENCHMARK</span>
            </div>
            <div className="hero-note-card">
              <div className="hero-note-header">
                <span>
                  <span className="rx-pill-tag" aria-hidden="true">Rx</span> PhLE STUDY PLAN
                </span>
                <span>06 MODULES</span>
              </div>
              <div className="hero-note-row">
                <span>M1</span>
                <strong>Pharmaceutical Chemistry</strong>
                <span className="hero-note-weight">20%</span>
              </div>
              <div className="hero-note-row">
                <span>M3</span>
                <strong>Practice of Pharmacy</strong>
                <span className="hero-note-weight">17%</span>
              </div>
              <div className="hero-note-row">
                <span>M4</span>
                <strong>Pharmacology &amp; PK</strong>
                <span className="hero-note-weight">15%</span>
              </div>
            </div>
            <div className="hero-photo-caption">
              <span>CLINICAL MASTERY</span>
              <span>BUILT FOR FUTURE RPh.</span>
            </div>
          </div>
        </section>

        <Reveal as="section" className="landing-route" aria-label="Your Pharmacy study journey">
          <div className="landing-wrap landing-route-inner">
            <div className="route-intro">
              <Icon name="pill" size={18} />
              <span>
                FROM NOTES
                <br />
                <strong>TO LICENSED RPh</strong>
              </span>
            </div>
            <div className="route-step">
              <span>01</span> UPLOAD PHARMACY NOTES
            </div>
            <div className="route-step">
              <span>02</span> DRILL CLINICAL CASES
            </div>
            <div className="route-step">
              <span>03</span> TRACK ALL 6 MODULES
            </div>
            <span className="route-end">
              <Icon name="arrow-up-right" size={18} />
            </span>
          </div>
        </Reveal>

        <Reveal as="section" id="how-it-works" className="landing-method landing-wrap">
          <div className="section-intro">
            <div>
              <span className="section-kicker">
                THE METHOD <span> / 01</span>
              </span>
              <h2>
                Six PhLE modules.
                <br />
                <em>Small, steady steps.</em>
              </h2>
            </div>
            <p>
              Preparing for the Pharmacist Licensure Examination takes focus. LisenSync helps you turn dense Pharmacy
              reviewers into a calm, consistent daily rhythm.
            </p>
          </div>
          <Reveal className="method-grid motion-stagger" id="study-tools">
            {steps.map((step) => (
              <article className="method-card" key={step.number}>
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
                <span className="section-kicker">THE PHARMACY STUDY SPACE / 02</span>
                <h2 id="landing-activity-title">
                  A little progress, <em>together.</em>
                </h2>
                <p>Live activity visible to this connection.</p>
              </div>
              <Reveal className="landing-activity-grid motion-stagger">
                {stats.map((stat) => (
                  <div className="landing-activity-stat" key={stat.label}>
                    <Icon name={stat.icon} size={18} />
                    <strong><AnimatedNumber value={stat.value} startOnView duration={1200} delay={80} /></strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </Reveal>
            </div>
          </Reveal>
        )}

        <Reveal as="section" id="syllabus" className="landing-programs">
          <div className="landing-wrap programs-layout">
            <div className="programs-copy">
              <span className="section-kicker">
                THE PhLE SYLLABUS <span> / 02</span>
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

        <Reveal as="section" className="landing-cta landing-wrap">
          <div className="cta-star">
            <Icon name="pill" size={23} />
          </div>
          <div>
            <span className="section-kicker">YOUR RPh CHAPTER IS WAITING</span>
            <h2>Ready when you are.</h2>
            <p>Make today a good day to begin your BS Pharmacy review.</p>
          </div>
          <Link to="/register" className="landing-primary-button">
            Create your account <Icon name="arrow-right" size={19} />
          </Link>
        </Reveal>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <Brand />
          <p>Made for BS Pharmacy candidates on the journey to RPh.</p>
          <div>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Get started</Link>
            <span>© {new Date().getFullYear()} LisenSync AI</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
