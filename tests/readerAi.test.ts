import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('reader assistant context', () => {
  it('sends the document, question and recent conversation to the model', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'An answer' }] } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { explainText } = await import('../src/lib/ai')
    const result = await explainText({
      selectedText: 'A document excerpt',
      followUp: 'Why does that matter?',
      history: [{ role: 'user', content: 'What is it?' }, { role: 'assistant', content: 'A concept.' }],
      program: 'pharmacy',
      subject: 'Pharmacology',
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const prompt = body.contents[0].parts[0].text
    expect(prompt).toContain('A document excerpt')
    expect(prompt).toContain('Student: What is it?')
    expect(prompt).toContain('Tutor: A concept.')
    expect(prompt).toContain('Student: Why does that matter?')
    expect(result.explanation).toBe('An answer')
  })
})
