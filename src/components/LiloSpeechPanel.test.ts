import { describe, expect, it } from 'vitest'
import { getAnswerFeedbackMessage } from './LiloSpeechPanel'

describe('Lilo answer feedback speech', () => {
  it('speaks the correct answer without adding rationale text', () => {
    expect(getAnswerFeedbackMessage(true, 'Metoprolol'))
      .toBe('Correct! The answer is Metoprolol.')
  })

  it('identifies the correct answer after an incorrect response', () => {
    expect(getAnswerFeedbackMessage(false, 'Metoprolol'))
      .toBe('Not quite! The correct answer is Metoprolol.')
  })

  it('still gives concise feedback when the answer text is missing', () => {
    expect(getAnswerFeedbackMessage(false, '   ')).toBe('Not quite!')
  })
})
