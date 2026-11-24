import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const file = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('side-by-side study chat', () => {
  it('keeps a composer available without requiring an explanation first', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    expect(reader).toContain('placeholder="Ask a follow-up question…"')
    expect(reader).toContain('aria-label="Ask a follow-up question"')
    expect(reader).not.toContain('>Your question</label>')
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
    expect(css).toMatch(/\.reader-side-panel\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*100%;/)
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

  it('gives the conversation room and prevents messages from shrinking under the composer', () => {
    const css = file('src/design.css')
    expect(css).toMatch(/\.reader-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(0, 2fr\)/s)
    expect(css).toMatch(/\.reader-grid\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/s)
    expect(css).toMatch(/\.reader-message\s*\{[^}]*flex:\s*0 0 auto/s)
    expect(css).toMatch(/\.reader-chat-composer\s*\{[^}]*flex:\s*0 0 auto/s)
  })

  it('keeps the assistant header compact while preserving accessible tab targets', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    const css = file('src/design.css')
    expect(reader).toContain('`Section ${currentPage} of ${totalPages}`')
    expect(css).toMatch(/\.reader-chat-header\s*\{[^}]*padding:\s*12px 16px/s)
    expect(css).toMatch(/\.reader-chat-avatar\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px/s)
    expect(css).toMatch(/\.reader-panel-tabs button\s*\{[^}]*min-height:\s*44px/s)
  })

  it('lets the assistant panel collapse to a rail and expand again', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    const css = file('src/design.css')
    expect(reader).toContain('const [chatCollapsed, setChatCollapsed] = useState(false)')
    expect(reader).toContain('aria-label="Collapse study assistant"')
    expect(reader).toContain('aria-label="Expand study assistant"')
    expect(reader).toContain('reader-grid--chat-collapsed')
    expect(css).toMatch(/\.reader-grid--chat-collapsed\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 56px/s)
    expect(css).toContain('.reader-grid .reader-side-panel--collapsed')
  })

  it('keeps document pagination visible while the document text scrolls', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    const css = file('src/design.css')

    expect(reader).toContain('className="reader-document-content"')
    expect(reader).toContain('className="reader-document-text"')
    expect(css).toMatch(/\.reader-document-text\s*\{[^}]*overflow-y:\s*auto/s)
    expect(css).toMatch(/\.reader-pagination\s*\{[^}]*flex:\s*0 0 auto/s)
  })

  it('lets document text shrink and wrap when the workspace width changes', () => {
    const css = file('src/design.css')

    expect(css).toMatch(/\.reader-document-card\s*\{[^}]*min-width:\s*0/s)
    expect(css).toMatch(/\.reader-document-content\s*\{[^}]*min-width:\s*0/s)
    expect(css).toMatch(/\.reader-document-text\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/s)
  })

  it('resets document scroll when changing sections', () => {
    const reader = file('src/pages/SideBySideReader.tsx')
    expect(reader).toContain('textRef.current?.scrollTo({ top: 0 })')
    expect(reader).toContain('}, [currentPage, materialId])')
  })

})
