import { describe, expect, it } from 'vitest'
import { validateGeneratedPracticeItems } from '../src/lib/practiceItemValidation'

describe('validateGeneratedPracticeItems', () => {
  it('accepts a complete MCQ and attaches trusted request metadata', () => {
    const [item] = validateGeneratedPracticeItems([{
      type: 'mcq',
      question: { stem: 'Which option?', options: ['A', 'B', 'C', 'D'] },
      answer: { correctIndex: 2 },
      rationale: 'Because C.',
    }], 'mcq', 'Pharmaceutics', 'pharmacy')

    expect(item).toMatchObject({
      type: 'mcq',
      subject: 'Pharmaceutics',
      board_program: 'pharmacy',
      answer: { correctIndex: 2 },
    })
  })

  it('rejects invalid MCQ indices and malformed sequence permutations', () => {
    expect(() => validateGeneratedPracticeItems([{
      question: { stem: 'Which option?', options: ['A', 'B', 'C', 'D'] },
      answer: { correctIndex: 4 },
    }], 'mcq', 'Pharmaceutics', 'pharmacy')).toThrow(/invalid mcq item at position 1/)

    expect(() => validateGeneratedPracticeItems([{
      question: { prompt: 'Order these', items: ['Mix', 'Heat', 'Cool'] },
      answer: { order: ['Mix', 'Heat', 'Mix'] },
    }], 'sequence', 'Pharmaceutics', 'pharmacy')).toThrow(/invalid sequence item at position 1/)
  })

  it('rejects empty or incomplete generated collections instead of silently saving them', () => {
    expect(() => validateGeneratedPracticeItems([], 'diagnosis', 'Pharmacy', 'pharmacy')).toThrow(/did not return any practice items/)
    expect(() => validateGeneratedPracticeItems([{
      question: { scenario: 'A case', prompt: 'Identify the drug.' },
      answer: { expected: '' },
    }], 'diagnosis', 'Pharmacy', 'pharmacy')).toThrow(/question or answer fields are missing/)
  })

  it('rejects enumeration lists with duplicate answers', () => {
    expect(() => validateGeneratedPracticeItems([{
      question: { prompt: 'List the examples.' },
      answer: { items: ['Example A', 'Example A'] },
    }], 'enumeration', 'Pharmacy', 'pharmacy')).toThrow(/invalid enumeration item/)
  })
})
