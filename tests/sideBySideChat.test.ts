import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const file = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('side-by-side study chat', () => {
  it('keeps a composer available without requiring an explanation first', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    expect(reader).toContain('Ask about this section')
    expect(reader).toContain("currentExplanation?.text || pageParagraphs.join")
    expect(reader).toContain('Chat is not saved')
  })

  it('includes recent conversation in follow-ups without saving them as highlights', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    const send = reader.slice(reader.indexOf('async function sendFollowUp'), reader.indexOf('async function clearAllHighlights'))
    expect(send).toContain('history')
    expect(send).not.toContain("from('document_highlights')")
    expect(file('src/lib/ai.ts')).toContain('(params.history || []).slice(-8)')
  })

  it('offers mobile document and chat views', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    expect(reader).toContain('reader-mobile-switch')
    expect(file('src/design.css')).toContain('.reader-grid .reader-mobile-hidden { display: none; }')
  })
  it('constrains the reader to the viewport and scrolls messages rather than the page', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    const css = file('src/design.css')
    expect(reader).toContain('messagesPanel.scrollTop = messagesPanel.scrollHeight')
    expect(reader).not.toContain('scrollIntoView')
    expect(css).toContain('height: calc(100dvh - 72px)')
    expect(css).toContain('height: calc(100dvh - 123px)')
    expect(css).toMatch(/\.reader-grid\s*\{[^}]*min-height:\s*0/s)
    expect(css).toMatch(/\.reader-chat-messages\s*\{[^}]*overflow-y:\s*auto/s)
  })

  it('guards asynchronous reader actions and preserves an unsent draft', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    expect(reader).toContain('return () => { active = false }')
    expect(reader).toContain('chatRequestPending.current = true')
    expect(reader).toContain('highlightPending.current = true')
    expect(reader).toContain('previous.trim() ? `${question}\\n\\n${previous}` : question')
    expect(reader).toContain("title: 'Explanation not saved'")
  })

})
