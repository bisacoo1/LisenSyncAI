import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('authenticated frontend hierarchy', () => {
  it('shows card-free study metrics first, followed by progress and the study plan', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const css = projectFile('src/design.css')

    const statsIndex = dashboard.indexOf('dashboard-stats-strip')
    const studyPlanIndex = dashboard.indexOf('study-plan-section')
    const readinessIndex = dashboard.indexOf('dashboard-feature-grid')

    expect(statsIndex).toBeGreaterThan(dashboard.indexOf('</header>'))
    expect(statsIndex).toBeLessThan(dashboard.indexOf('course-overview-panel'))
    expect(statsIndex).toBeLessThan(readinessIndex)
    expect(studyPlanIndex).toBeGreaterThan(0)
    expect(readinessIndex).toBeGreaterThan(0)
    expect(dashboard.indexOf('course-overview-panel')).toBeLessThan(studyPlanIndex)
    expect(readinessIndex).toBeLessThan(studyPlanIndex)
    expect(dashboard).not.toContain('momentum-card')
    expect(css).toContain('.dashboard-page .dashboard-stats-strip')
    expect(css).toMatch(/\.dashboard-page \.dashboard-stat\s*\{[^}]*background:\s*transparent/s)
    expect(css).toMatch(/\.dashboard-page \.study-plan-section\s*\{[^}]*margin-top:\s*40px/s)
    expect(css).toMatch(/\.study-plan-step[^{]*\{[^}]*box-shadow:/s)
  })

  it('hides decorative mobile workspace metadata at the small-screen breakpoint', () => {
    const css = projectFile('src/design.css')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 680px)'))

    expect(mobileRules).toMatch(/\.workspace-topbar-right\s*\{[^}]*display:\s*none/s)
  })

  it('keeps practice and mock exam work surfaces in focused layouts', () => {
    const css = projectFile('src/design.css')

    expect(css).toMatch(/\.practice-question-card\s*\{/)
    expect(css).toMatch(/\.practice-controls-card\s*\{/)
    expect(css).toMatch(/\.mock-exam|\.timer\s*\{/)
  })
  it('keeps all study plan actions available on mobile and links drills to their subject', () => {
    const css = projectFile('src/design.css')
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    expect(css).toMatch(/\.study-plan-list li:not\(:first-child\)\s*\{\s*display:\s*block/)
    expect(dashboard).toContain('/practice?subject=${encodeURIComponent(s.subject)}')
  })

  it('initializes the workspace theme from the stored preference', () => {
    const layout = projectFile('src/components/Layout.tsx')
    expect(layout.indexOf("localStorage.getItem('theme')")).toBeLessThan(layout.indexOf("localStorage.setItem('theme'"))
  })

})

describe('dashboard failure handling', () => {
  it('shows a retry instead of presenting failed queries as empty progress', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    expect(dashboard).toContain('if (error) throw error')
    expect(dashboard).toContain('if (loadError) return')
    expect(dashboard).toContain('setReloadCount(value => value + 1)')
    expect(dashboard).toContain('return () => { active = false }')
  })
})

describe('consistent dashboard surfaces', () => {
  it('uses shared theme surfaces for the dashboard cards without overriding semantic status colors', () => {
    const css = projectFile('src/design.css')
    const palette = css.slice(css.indexOf('/* Consistent workspace surfaces:'))
    expect(palette).toContain(':root .dashboard-page .readiness-panel,')
    expect(palette).toContain(':root .dashboard-page .toolkit-card:nth-child(2),')
    expect(palette).toContain('background: var(--panel);')
    expect(palette).toContain('border: 1px solid var(--border);')
    expect(palette).toContain('background: var(--primary);')
    expect(palette).not.toContain('.ui-badge')
  })
})

describe('mint workspace theme', () => {
  it('provides light and dark workspace palettes with accessible active navigation', () => {
    const theme = projectFile('src/index.css')
    const styles = projectFile('src/design.css')
    expect(theme).toContain(':root .app-shell,')
    expect(theme).toContain(':root.dark .app-shell,')
    expect(theme).toContain(':root:not(.light):not(.dark) .app-shell')
    expect(theme).toContain('--workspace-nav-active-text: #ffffff')
    expect(theme).toContain('--workspace-nav-active-text: #0d3027')
    expect(styles).toContain('outline: 3px solid var(--primary)')
    expect(styles).not.toContain('--bg: #f3f7f5')
  })
})

describe('accessible route and study controls', () => {
  it('moves focus to a named main landmark after route changes', () => {
    const app = projectFile('src/App.tsx')
    const layout = projectFile('src/components/Layout.tsx')
    expect(app).toContain("document.querySelector<HTMLElement>('[data-route-main]')?.focus()")
    expect(layout).toContain('aria-label={pageName} data-route-main')
  })

  it('uses native radio inputs for the mutually exclusive study track', () => {
    const selector = projectFile('src/components/StudyTrackSelector.tsx')
    const reader = projectFile('src/pages/SideBySideReader.tsx')
    expect(selector).toContain('<fieldset className="study-track-selector">')
    expect(selector).toContain('type="radio"')
    expect(reader).toContain('role="group" aria-label="Reader view"')
  })

  it('keeps practice answer feedback inline without a duplicate result toast', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const handlers = practice.slice(practice.indexOf('async function submitMcq()'), practice.indexOf('function questionContext'))
    expect(handlers).toContain('setFeedback')
    expect(handlers).not.toContain('addToast')
  })

  it('gives the narrow analytics chart a visible scroll affordance', () => {
    const analytics = projectFile('src/pages/AnalyticsPage.tsx')
    const styles = projectFile('src/design.css')
    expect(analytics).toContain('className="table-wrapper trend-chart-scroll"')
    expect(analytics).toContain('scroll horizontally for more dates')
    expect(styles).toContain(".trend-chart-scroll::after { content: 'Swipe or scroll chart for more dates'; }")
  })
})
