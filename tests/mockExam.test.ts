import { describe, expect, it } from 'vitest'
import type { MockExamItem, PracticeItem } from '../src/types'
import { buildMockSubmissionAnswers, isMockAnswerCorrect, selectMockExamItems } from '../src/lib/mockExam'

const mcq = (id: string, subject: string, type = 'mcq'): PracticeItem => ({
  id,
  user_id: 'user',
  material_id: null,
  board_program: 'pharmacy',
  subject,
  type: type as PracticeItem['type'],
  question: { stem: 'Question', options: ['A', 'B', 'C', 'D'] },
  answer: { correctIndex: 1 },
  rationale: null,
})

describe('mock exam allocation and submission helpers', () => {
  it('selects only the requested valid items from each TOS subject', () => {
    const selected = selectMockExamItems([
      { subject: 'Chemistry', items: 1, weightPercent: 50 },
      { subject: 'Pharmacy', items: 1, weightPercent: 50 },
    ], [
      mcq('chem-1', 'Chemistry'),
      mcq('chem-unsupported', 'Chemistry', 'enumeration'),
      mcq('pharmacy-1', 'Pharmacy'),
      mcq('other-subject', 'Other'),
    ], () => 0)

    expect(selected.map(item => item.id).sort()).toEqual(['chem-1', 'pharmacy-1'])
  })

  it('fails instead of creating a partial allocation', () => {
    expect(() => selectMockExamItems([
      { subject: 'Chemistry', items: 2, weightPercent: 100 },
    ], [mcq('one', 'Chemistry')])).toThrow(/needs 2 valid.*only 1 are available/)
  })

  it('includes unanswered items in the atomic submission payload', () => {
    const items = [{ id: 'item-1' }, { id: 'item-2' }] as MockExamItem[]
    expect(buildMockSubmissionAnswers(items, { 'item-1': { selected: 0 } })).toEqual([
      { item_id: 'item-1', user_response: { selected: 0 } },
      { item_id: 'item-2', user_response: null },
    ])
  })

  it('scores diagnosis answers consistently with local result fallbacks', () => {
    const item = {
      id: 'diagnosis',
      type: 'diagnosis',
      answer: { expected: 'beta blocker', acceptable: ['beta-blocking agent'] },
    } as MockExamItem
    expect(isMockAnswerCorrect(item, { text: 'Beta-blocking agent' })).toBe(true)
    expect(isMockAnswerCorrect(item, { text: '' })).toBe(false)
  })
})
