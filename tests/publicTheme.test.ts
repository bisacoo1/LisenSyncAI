import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public page theme', () => {
  it('applies the workspace palette to landing and auth pages in both modes', () => {
    const css = readFileSync('src/design.css', 'utf8')
    const publicTheme = css.slice(css.indexOf('/* Public pages share the workspace'))
    expect(publicTheme).toContain(':root :is(.landing, .auth-layout)')
    expect(publicTheme).toContain(':root.dark :is(.landing, .auth-layout)')
    expect(publicTheme).toContain('prefers-color-scheme: dark')
    expect(publicTheme).toContain('--public-action: #073b39')
    expect(publicTheme).toContain('outline: 3px solid var(--primary)')
    expect(publicTheme).toContain('.landing-programs .section-kicker')
  })

  it('restores a saved preference before rendering public pages', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main.indexOf("localStorage.getItem('theme')")).toBeLessThan(main.indexOf('ReactDOM.createRoot'))
  })
})
