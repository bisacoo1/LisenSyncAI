import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Brand } from '@/components/Brand'
import { Icon, type IconName } from '@/components/ui'
import { PROGRAM_LIST } from '@/lib/syllabus'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import studyDesk from '@/assets/study-desk.jpg'

const steps: { number: string; icon: IconName; title: string; description: string; note: string }[] = [
  {
    number: '01',
    icon: 'upload',
    title: 'Bring your notes',
    description: 'Upload your review materials and turn them into a study set built around your subjects.',
    note: 'PDF · DOCX · PPT'
  },
  {
    number: '02',
    icon: 'brain',
    title: 'Make it stick',
    description: 'Build confidence with flashcards, situational questions, and case-based drills.',
    note: 'ACTIVE RECALL'
  },
  {
    number: '03',
    icon: 'target',
    title: 'See your progress',
    description: 'Try a timed mock exam and find the subjects that could use a little more attention.',
    note: 'PRACTICE WITH PURPOSE'
  }
]

const programs: { icon: IconName; name: string; label: string }[] = [
  { icon: 'shield', name: 'Criminology', label: 'THE CRIMINOLOGIST' },
  { icon: 'sparkles', name: 'Pharmacy', label: 'THE PHARMACIST' },
  { icon: 'activity', name: 'Civil Engineering', label: 'THE ENGINEER' }
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
          { label: 'Study profiles', value: profiles.count!, icon: 'user' },
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
            THE LICENSURE STUDY SPACE <i /> MADE FOR YOUR NEXT CHAPTER
          </span>
          <span className="announcement-right">
            A LITTLE PROGRESS, EVERY DAY <Icon name="arrow-up-right" size={13} />
          </span>
        </div>
      </div>

      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Brand />
          <nav className="landing-nav-links" aria-label="Page navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#study-tools">Study tools</a>
            <a href="#programs">Programs</a>
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
              <span className="eyebrow-dot" /> YOUR PRC REVIEW COMPANION <span className="eyebrow-index">/ 01</span>
            </div>
            <h1>
              Your next chapter starts with a <em>good study day.</em>
            </h1>
            <p>
              Turn your notes into meaningful practice, track your progress, and head into your board exam feeling a
              little more ready.
            </p>
            <div className="landing-hero-actions">
              <Link to="/register" className="landing-primary-button">
                Start reviewing <Icon name="arrow-right" size={19} />
              </Link>
              <a href="#how-it-works" className="landing-text-link">
                See how it works <Icon name="arrow-down" size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span className="hero-footnote-icon">
                <Icon name="book-open" size={17} />
              </span>
              <span>
                For the long nights, small wins,
                <br />
                <strong>and the license at the end.</strong>
              </span>
            </div>
          </div>

          <div className="landing-hero-visual">
            <img src={studyDesk} alt="An open notebook and pencil on a sunlit study desk" />
            <div className="hero-image-overlay" />
            <div className="hero-image-top">
              <span>
                <Icon name="sparkles" size={15} /> A SPACE TO FOCUS
              </span>
              <span>VOL. 01 / THE REVIEW</span>
            </div>
            <div className="hero-stamp" aria-label="75 percent passing benchmark">
              <span>THE GOAL</span>
              <strong>
                75<small>%</small>
              </strong>
              <span>PASSING BENCHMARK</span>
            </div>
            <div className="hero-note-card">
              <div className="hero-note-header">
                <span>
                  <Icon name="list-checks" size={17} /> THE STUDY FLOW
                </span>
                <span>01 — 03</span>
              </div>
              <div className="hero-note-row">
                <span>01</span>
                <strong>Gather your notes</strong>
                <Icon name="check" size={15} />
              </div>
              <div className="hero-note-row">
                <span>02</span>
                <strong>Practice what matters</strong>
                <Icon name="check" size={15} />
              </div>
              <div className="hero-note-row">
                <span>03</span>
                <strong>Grow your confidence</strong>
                <Icon name="arrow-up-right" size={15} />
              </div>
            </div>
            <div className="hero-photo-caption">
              <span>THE STUDY SESSIONS</span>
              <span>THAT ADD UP.</span>
            </div>
          </div>
        </section>

        <section className="landing-route" aria-label="Your study journey">
          <div className="landing-wrap landing-route-inner">
            <div className="route-intro">
              <Icon name="sparkles" size={18} />
              <span>
                FROM NOTES
                <br />
                <strong>TO KNOW-HOW</strong>
              </span>
            </div>
            <div className="route-step">
              <span>01</span> UPLOAD YOUR REVIEWER
            </div>
            <div className="route-step">
              <span>02</span> PRACTICE YOUR WAY
            </div>
            <div className="route-step">
              <span>03</span> TRACK WHAT MATTERS
            </div>
            <span className="route-end">
              <Icon name="arrow-up-right" size={18} />
            </span>
          </div>
        </section>

        <section id="how-it-works" className="landing-method landing-wrap">
          <div className="section-intro">
            <div>
              <span className="section-kicker">
                THE METHOD <span> / 01</span>
              </span>
              <h2>
                Big goals.
                <br />
                <em>Small, steady steps.</em>
              </h2>
            </div>
            <p>
              Preparing for your boards is a journey. LisenSync helps you find a rhythm, one study session at a time.
            </p>
          </div>
          <div className="method-grid" id="study-tools">
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
          </div>
        </section>

        {stats && (
          <section className="landing-activity" aria-labelledby="landing-activity-title">
            <div className="landing-wrap landing-activity-inner">
              <div className="landing-activity-intro">
                <span className="section-kicker">THE STUDY SPACE / 02</span>
                <h2 id="landing-activity-title">
                  A little progress, <em>together.</em>
                </h2>
                <p>Live activity visible to this connection.</p>
              </div>
              <div className="landing-activity-grid">
                {stats.map((stat) => (
                  <div className="landing-activity-stat" key={stat.label}>
                    <Icon name={stat.icon} size={18} />
                    <strong>{stat.value.toLocaleString()}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="programs" className="landing-programs">
          <div className="landing-wrap programs-layout">
            <div className="programs-copy">
              <span className="section-kicker">
                YOUR PATH <span> / 02</span>
              </span>
              <h2>
                Made for the
                <br />
                <em>work ahead.</em>
              </h2>
              <p>
                Choose your board program and make your study space your own. Your subjects and practice stay together,
                wherever you are in your review.
              </p>
              <Link to="/register" className="programs-link">
                Find your study rhythm <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <div className="program-list">
              <div className="program-list-heading">
                <span>EXPLORE OUR PROGRAMS</span>
                <span>0{PROGRAM_LIST.length} AVAILABLE</span>
              </div>
              {programs.map((program, index) => (
                <div className="program-row" key={program.name}>
                  <span className="program-number">0{index + 1}</span>
                  <span className="program-icon">
                    <Icon name={program.icon} size={19} />
                  </span>
                  <span className="program-name">
                    <small>{program.label}</small>
                    <strong>{program.name}</strong>
                  </span>
                  <Icon name="arrow-up-right" size={19} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta landing-wrap">
          <div className="cta-star">
            <Icon name="sparkles" size={23} />
          </div>
          <div>
            <span className="section-kicker">YOUR NEXT CHAPTER IS WAITING</span>
            <h2>Ready when you are.</h2>
            <p>Make today a good day to begin.</p>
          </div>
          <Link to="/register" className="landing-primary-button">
            Create your account <Icon name="arrow-right" size={19} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <Brand />
          <p>Made for the journey to licensed.</p>
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
