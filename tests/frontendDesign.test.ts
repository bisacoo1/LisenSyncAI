import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('authenticated frontend hierarchy', () => {
  it('promotes the dashboard study plan and keeps secondary surfaces restrained', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const css = projectFile('src/design.css')

    const studyPlanIndex = dashboard.indexOf('study-plan-section')
    const readinessIndex = dashboard.indexOf('dashboard-feature-grid')

    expect(studyPlanIndex).toBeGreaterThan(0)
    expect(readinessIndex).toBeGreaterThan(studyPlanIndex)
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
