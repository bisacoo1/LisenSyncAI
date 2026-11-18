import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('brand mark theme', () => {
  it('uses the teal background consistently for normal and inverse brand marks', () => {
    const css = readFileSync('src/design.css', 'utf8')
    expect(css).toMatch(/\.brand-lockup-mark\s*\{[^}]*background:\s*linear-gradient\(145deg,\s*#073b39\s*0%,\s*#12675b\s*100%\)/s)
    expect(css).not.toMatch(/\.brand-lockup-mark\s*\{[^}]*#0f223d/s)
    expect(css).toMatch(/\.brand-lockup--inverse \.brand-lockup-mark\s*\{[^}]*174,\s*229,\s*213/s)
  })
})
