import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LandingPage from '../src/pages/LandingPage'
import LoginPage from '../src/pages/LoginPage'
import RegisterPage from '../src/pages/RegisterPage'
import { StudyPreview } from '../src/components/StudyPreview'
import { ToastProvider } from '../src/components/ui'
import { PHARMACY_PROGRAM } from '../src/lib/syllabus'

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ ...auth, refreshProfile: vi.fn() }),
  upsertProfile: vi.fn(),
}))

function renderPage(page: React.ReactNode, location = '/') {
  return renderToStaticMarkup(
    <StaticRouter location={location}>
      <ToastProvider>{page}</ToastProvider>
    </StaticRouter>
  )
}

describe('public study experience', () => {
  it('offers both study tracks and routes new visitors to registration', () => {
    auth.user = null
    const html = renderPage(<LandingPage />)
    expect(html).toContain('aria-label="Choose your study mode"')
    expect(html).toContain('PhLE board review')
    expect(html).toContain('BS Pharmacy courses')
    expect(html).toContain('href="/register?track=board"')
    expect(html).toContain('href="/register?track=course"')
    expect(html).toContain('href="/login"')
    expect(html).toContain('aria-controls="public-mobile-nav"')
  })

  it('shows all six existing pharmacy modules without inventing subjects', () => {
    const html = renderPage(<LandingPage />)
    for (const subject of PHARMACY_PROGRAM.subjectDetails) {
      // React escapes ampersands and apostrophes in rendered copy.
      expect(html).toContain(subject.name.replaceAll('&', '&amp;'))
    }
    expect((html.match(/class="public-subject-card"/g) || []).length).toBe(6)
  })

  it('takes signed-in students back to their workspace', () => {
    auth.user = { id: 'test-student' }
    const html = renderPage(<LandingPage />)
    expect(html).toContain('Go to my workspace')
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain('href="/register?track=board"')
    auth.user = null
  })

  it('labels the interactive preview as an example, not real student progress', () => {
    const html = renderToStaticMarkup(<StudyPreview />)
    expect(html).toContain('Example preview')
    expect(html).toContain('Sample question')
    expect(html).toContain('aria-live="polite"')
    expect((html.match(/aria-pressed="false"/g) || []).length).toBe(3)
    const course = renderToStaticMarkup(<StudyPreview track="course" />)
    expect(course).toContain('Make today a good study day')
    expect(course).not.toContain('A little closer to exam-ready')
  })
})

describe('account forms', () => {
  it('retains labeled login fields and password visibility control', () => {
    const html = renderPage(<LoginPage />, '/login')
    expect(html).toContain('Email address')
    expect(html).toContain('type="email"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('aria-label="Show password"')
    expect(html).toContain('href="/register"')
    expect(html).toContain('type="submit"')
  })

  it('preserves a course-mode selection from the landing page', () => {
    const html = renderPage(<RegisterPage />, '/register?track=course')
    expect(html).toMatch(
      /<input(?=[^>]*value="course")(?=[^>]*checked="")[^>]*>/
    )
    expect(html).not.toMatch(
      /<input(?=[^>]*value="board")(?=[^>]*checked="")[^>]*>/
    )
    expect(html).toContain('Organize your own subjects')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('minLength="6"')
  })

  it('defaults to board review when a track is missing or unrecognized', () => {
    for (const path of ['/register', '/register?track=unknown']) {
      const html = renderPage(<RegisterPage />, path)
      expect(html).toMatch(
        /<input(?=[^>]*value="board")(?=[^>]*checked="")[^>]*>/
      )
      expect(html).not.toMatch(
        /<input(?=[^>]*value="course")(?=[^>]*checked="")[^>]*>/
      )
      expect(html).toContain('Review across all 6 PhLE modules')
    }
  })
})
