import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public page theme', () => {
  it('shares a scoped navy-and-violet light palette across landing and account screens', () => {
    const styles = readFileSync('src/public.css', 'utf8')
    const entry = readFileSync('src/main.tsx', 'utf8')
    expect(styles).toContain(':root :is(.public-site, .public-auth)')
    expect(styles).toContain('color-scheme: light')
    expect(styles).toContain('--text: #19243c')
    expect(styles).toContain('--primary: #6850ca')
    expect(entry.indexOf("import './public.css'")).toBeGreaterThan(
      entry.indexOf("import './design.css'")
    )
  })

  it('supports keyboard focus, reduced motion, and narrow-screen layouts', () => {
    const styles = readFileSync('src/public.css', 'utf8')
    expect(styles).toContain(':focus-visible')
    expect(styles).toContain('.public-skip:focus')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain('@media (max-width: 640px)')
    expect(styles).toContain('@media (max-width: 360px)')
  })

  it('leaves the saved workspace theme preference intact', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    const preferenceIndex = main.indexOf(
      "localStorage.getItem('workspace-theme')"
    )
    expect(preferenceIndex).toBeGreaterThan(-1)
    expect(preferenceIndex).toBeLessThan(main.indexOf('ReactDOM.createRoot'))
    expect(readFileSync('src/pages/LandingPage.tsx', 'utf8')).not.toContain(
      'localStorage.setItem'
    )
  })
})
