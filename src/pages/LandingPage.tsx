import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button, Card, CardHeader, CardContent, Icon, Badge, type IconName } from '@/components/ui'

export default function LandingPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [stats, setStats] = useState<{ label: string; value: string | number; icon: IconName; color: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      nav('/dashboard', { replace: true })
      return
    }
    loadStats()
  }, [profile, nav])

  async function loadStats() {
    try {
      const [usersRes, materialsRes, mocksRes, subjectsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('review_materials').select('id', { count: 'exact', head: true }),
        supabase.from('mock_exams').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('practice_items').select('subject', { count: 'exact', head: true }),
      ])
      setStats([
        { label: 'Registered Reviewers', value: usersRes.count ?? 0, icon: 'user', color: 'var(--primary)' },
        { label: 'Subjects Practiced', value: subjectsRes.count ?? 0, icon: 'book-open', color: 'var(--accent)' },
        { label: 'Review Materials', value: materialsRes.count ?? 0, icon: 'file-text', color: 'var(--info)' },
        { label: 'Mock Exams Completed', value: mocksRes.count ?? 0, icon: 'timer', color: 'var(--success)' },
      ])
    } catch {
      setStats([
        { label: 'Registered Reviewers', value: 0, icon: 'user', color: 'var(--primary)' },
        { label: 'Subjects Practiced', value: 0, icon: 'book-open', color: 'var(--accent)' },
        { label: 'Review Materials', value: 0, icon: 'file-text', color: 'var(--info)' },
        { label: 'Mock Exams Completed', value: 0, icon: 'timer', color: 'var(--success)' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: 'file-text' as IconName,
      title: 'Smart Document Processing',
      desc: 'Upload PDF, DOCX, or PPT reviewers. AI extracts key concepts and converts them into active-recall flashcards instantly.',
    },
    {
      icon: 'brain' as IconName,
      title: 'PRC-Style Practice',
      desc: 'Situational MCQs, case diagnosis, and priority/sequence ordering aligned to your board syllabus with step-by-step rationale.',
    },
    {
      icon: 'timer' as IconName,
      title: 'Timed Mock Simulations',
      desc: 'Full-length mock exams with board-exam timing, TOS allocation, and detailed analytics to gauge your readiness.',
    },
    {
      icon: 'bar-chart' as IconName,
      title: 'Readiness Analytics',
      desc: 'Track your mastery per subject, spot weak areas, and monitor your streak, XP, and level as you study.',
    },
    {
      icon: 'trophy' as IconName,
      title: 'Gamified Progress',
      desc: 'Earn XP, level up, keep your daily streak alive, and hit your daily practice goals to stay motivated.',
    },
    {
      icon: 'check-circle' as IconName,
      title: 'Board-Aligned Syllabus',
      desc: 'Criminology, Pharmacy, and Civil Engineering programs with official subject mappings and TOS weightings.',
    },
  ]

  return (
    <div className="container" style={{ paddingTop: 0, paddingBottom: 80 }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)', background: 'rgba(10, 15, 26, 0.8)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="logo" size={18} style={{ color: '#041014' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text)' }}>LisenSync AI</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/login" style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 500 }}>Log in</Link>
            {!loading && !profile && (
              <Button variant="primary" size="sm" onClick={() => nav('/register')}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>

      <section style={{ padding: '80px 0 60px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Badge variant="primary" size="sm" style={{ display: 'inline-block', marginBottom: 20 }}>
            <Icon name="zap" size={14} style={{ marginRight: 6 }} />
            PRC Licensure Exam Reviewer
          </Badge>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 24, color: 'var(--text)' }}>
            Study Smarter. Pass Your Board Exam.
          </h1>
          <p style={{ fontSize: 20, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 36, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            AI-powered flashcards, situational practice, and timed mock simulations aligned to the official PRC board syllabus. Track your streak, level up, and know exactly when you're ready.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => nav('/register')} fullWidth style={{ maxWidth: 260 }}>
              Start Reviewing <Icon name="chevron-right" size={18} style={{ marginLeft: 8 }} />
            </Button>
            <Button variant="outline" size="lg" onClick={() => nav('/login')} fullWidth style={{ maxWidth: 200 }}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0', background: 'var(--panel-2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: 'var(--text)' }}>Community Progress</h2>
          <p style={{ color: 'var(--muted)', fontSize: 16 }}>Real-time stats from LisenSync AI reviewers</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 1000, margin: '0 auto' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: 28, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, background: `${s.color}20`, borderRadius: '50%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                  <Icon name={s.icon} size={18} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{loading ? '—' : s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {s.label === 'Registered Reviewers' ? 'active users' : s.label === 'Subjects Practiced' ? 'distinct subjects' : s.label === 'Review Materials' ? 'documents uploaded' : 'completed simulations'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, color: 'var(--text)' }}>Everything You Need to Pass</h2>
          <p style={{ color: 'var(--muted)', fontSize: 16, maxWidth: 640, margin: '0 auto' }}>From uploading your reviewer to simulating the actual board exam, every feature is built for PRC licensure success.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {features.map((f, i) => (
            <Card key={i} variant="outlined" style={{ padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name={f.icon} size={20} strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{f.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section style={{ padding: '80px 0', background: 'linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)', border: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 16, color: 'var(--text)' }}>Ready to start your review?</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 17, marginBottom: 28, lineHeight: 1.6 }}>Join hundreds of PRC examinees using LisenSync AI to prepare for their board exam.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => nav('/register')} fullWidth style={{ maxWidth: 260 }}>
              Create Free Account <Icon name="chevron-right" size={18} style={{ marginLeft: 8 }} />
            </Button>
            <Button variant="outline" size="lg" onClick={() => nav('/login')} fullWidth style={{ maxWidth: 200 }}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      <footer style={{ padding: '60px 0 40', borderTop: '1px solid var(--border)', marginTop: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="logo" size={16} style={{ color: '#041014' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text)' }}>LisenSync AI</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          AI-powered PRC licensure exam reviewer with flashcards, practice drills, mock exams, and readiness analytics.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          <Link to="/login" style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>Log in</Link>
          <Link to="/register" style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>Register</Link>
          <span style={{ color: 'var(--muted-strong)', fontSize: 13 }}>
            {String.fromCharCode(169)} {new Date().getFullYear()} LisenSync AI
          </span>
        </div>
      </footer>
    </div>
  )
}
