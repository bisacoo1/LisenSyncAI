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
})
