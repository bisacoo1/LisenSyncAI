import type { MockExamItem, PracticeItem, SequenceAnswer, TosAllocation } from '@/types'
import { checkDiagnosis, checkSequence } from './analytics'
import { isValidMockPracticeItem } from './practiceItemValidation'

export function selectMockExamItems(
  allocations: TosAllocation[],
  available: PracticeItem[],
  random: () => number = Math.random,
): PracticeItem[] {
  const selected: PracticeItem[] = []
  for (const allocation of allocations) {
    const eligible = available.filter(item =>
      item.subject === allocation.subject
      && ['mcq', 'diagnosis', 'sequence'].includes(item.type)
      && isValidMockPracticeItem(item),
    )
    if (eligible.length < allocation.items) {
      throw new Error(
        `${allocation.subject} needs ${allocation.items} valid MCQ, diagnosis, or sequence items; only ${eligible.length} are available.`,
      )
    }

    const shuffled = [...eligible]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }
    selected.push(...shuffled.slice(0, allocation.items))
  }
  return selected
}

export function isMockAnswerCorrect(item: MockExamItem, response: unknown): boolean {
  const answer = response as { selected?: number; text?: string; order?: string[] } | null
  if (item.type === 'mcq') {
    return answer?.selected === (item.answer as { correctIndex: number }).correctIndex
  }
  if (item.type === 'diagnosis') {
    const diagnosis = item.answer as { expected: string; acceptable?: string[] }
    return checkDiagnosis(answer?.text || '', diagnosis.expected, diagnosis.acceptable || [])
  }
  if (item.type === 'sequence') {
    return checkSequence(answer?.order || [], (item.answer as SequenceAnswer).order || [])
  }
  return false
}

export function buildMockSubmissionAnswers(
  items: MockExamItem[],
  responses: Record<string, unknown>,
) {
  return items.map(item => ({
    item_id: item.id,
    user_response: responses[item.id] ?? null,
  }))
}
