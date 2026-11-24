import { describe, expect, it } from 'vitest'
import { getStudyModeProgress, parseCompletedStudyModes, studyModeProgressKey } from './studyModeProgress'

describe('getStudyModeProgress', () => {
  it('hides the alternate-mode prompt when every available mode is complete', () => {
    expect(getStudyModeProgress(
      ['mcq', 'flashcards'],
      ['flashcards'],
      'mcq',
      true,
    )).toEqual({ allComplete: true, hasUncompletedAlternative: false })
  })

  it('keeps the prompt while another available mode is unfinished', () => {
    expect(getStudyModeProgress(
      ['mcq', 'flashcards', 'sequence'],
      ['flashcards'],
      'mcq',
      true,
    )).toEqual({ allComplete: false, hasUncompletedAlternative: true })
  })

  it('does not count the current mode as finished when the learner skipped items', () => {
    expect(getStudyModeProgress(
      ['mcq', 'flashcards'],
      ['flashcards'],
      'mcq',
      false,
    )).toEqual({ allComplete: false, hasUncompletedAlternative: false })
  })

  it('uses the material-scoped storage key shared by practice and achievements', () => {
    expect(studyModeProgressKey('user-1', 'material-2', 'Pharmaceutics'))
      .toBe('pharmora-study-mode-progress:user-1:material-2')
  })

  it('parses valid stored modes and rejects invalid progress', () => {
    expect(parseCompletedStudyModes('["mcq","flashcards","mcq"]')).toEqual(['mcq', 'flashcards'])
    expect(() => parseCompletedStudyModes('["mock-exam"]')).toThrow('Saved study mode progress is invalid.')
  })
})
