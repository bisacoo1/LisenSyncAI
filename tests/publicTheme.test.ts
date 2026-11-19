import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public page theme', () => {
  it('applies the workspace palette to landing and auth pages in both modes', () => {
    const theme = readFileSync('src/index.css', 'utf8')
    const styles = readFileSync('src/design.css', 'utf8')
    expect(theme).toContain(':root :is(.landing, .auth-layout)')
    expect(theme).toContain(':root.dark :is(.landing, .auth-layout)')
    expect(theme).toContain('@media (prefers-color-scheme: dark)')
    expect(theme).toContain('--public-action: #0b6b58')
    expect(styles).toContain('outline: 3px solid var(--primary)')
    expect(styles).toContain('.landing-programs .section-kicker')
  })

  it('restores a saved preference before rendering public pages', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main.indexOf("localStorage.getItem('theme')")).toBeLessThan(main.indexOf('ReactDOM.createRoot'))
  })
})
