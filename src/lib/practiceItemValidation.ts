import type {
  BoardProgramKey,
  DiagnosisAnswer,
  DiagnosisQuestion,
  EnumerationAnswer,
  McqAnswer,
  McqQuestion,
  PracticeItem,
  PracticeType,
  SequenceAnswer,
  SequenceQuestion,
} from '@/types'

export type GeneratedPracticeItem = Pick<
  PracticeItem,
  'type' | 'subject' | 'board_program' | 'question' | 'answer' | 'rationale'
>

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown, minimumLength = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimumLength && value.every(isNonEmptyString)
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function isPermutation(items: string[], order: string[]) {
  if (items.length !== order.length) return false
  const expected = items.map(normalized).sort()
  const actual = order.map(normalized).sort()
  return expected.every((value, index) => value.length > 0 && value === actual[index])
}

function invalidItem(index: number, type: PracticeType, reason: string): never {
  throw new Error(`AI returned an invalid ${type} item at position ${index + 1}: ${reason}`)
}

const enumerationCountWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

export function getEnumerationPromptCount(prompt: string): number | null {
  const match = prompt.match(/\b(?:enumerate|list|name|provide|give)\s+(?:(?:the|all|following|top)\s+)*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i)
  if (!match) return null
  const token = match[1].toLowerCase()
  const count = enumerationCountWords[token] || Number(token)
  return Number.isInteger(count) && count > 0 ? count : null
}

export function isValidMockPracticeItem(item: PracticeItem): boolean {
  if (item.type === 'mcq') {
    const question = item.question as McqQuestion
    const answer = item.answer as McqAnswer
    return isNonEmptyString(question?.stem)
      && isStringArray(question?.options, 4)
      && question.options.length === 4
      && Number.isInteger(answer?.correctIndex)
      && answer.correctIndex >= 0
      && answer.correctIndex < question.options.length
  }
  if (item.type === 'diagnosis' || item.type === 'identification') {
    const question = item.question as DiagnosisQuestion
    const answer = item.answer as DiagnosisAnswer
    return isNonEmptyString(question?.scenario)
      && isNonEmptyString(question?.prompt)
      && isNonEmptyString(answer?.expected)
      && (answer.acceptable === undefined || isStringArray(answer.acceptable, 0))
  }
  if (item.type === 'sequence') {
    const question = item.question as SequenceQuestion
    const answer = item.answer as SequenceAnswer
    return isNonEmptyString(question?.prompt)
      && isStringArray(question?.items, 2)
      && Array.isArray(answer?.order)
      && isStringArray(answer.order, 2)
      && isPermutation(question.items, answer.order)
  }
  if (item.type === 'enumeration') {
    const question = item.question as DiagnosisQuestion
    const answer = item.answer as EnumerationAnswer
    return isNonEmptyString(question?.prompt) && isStringArray(answer?.items)
  }
  return false
}

export function validateGeneratedPracticeItems(
  output: unknown,
  type: PracticeType,
  subject: string,
  boardProgram: BoardProgramKey,
): GeneratedPracticeItem[] {
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error('AI did not return any practice items. Please try generating the study set again.')
  }

  return output.map((value: unknown, index): GeneratedPracticeItem => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return invalidItem(index, type, 'expected an object')
    }

    const item = value as Record<string, unknown>
    const question = item.question
    const answer = item.answer
    const rationale = item.rationale
    if (rationale !== undefined && rationale !== null && typeof rationale !== 'string') {
      return invalidItem(index, type, 'rationale must be text')
    }

    let valid = false
    if (type === 'mcq') {
      const q = question as McqQuestion | undefined
      const a = answer as McqAnswer | undefined
      valid = isNonEmptyString(q?.stem)
        && isStringArray(q?.options, 4)
        && q.options.length === 4
        && a !== undefined
        && Number.isInteger(a.correctIndex)
        && a.correctIndex >= 0
        && a.correctIndex < q.options.length
    } else if (type === 'diagnosis' || type === 'identification') {
      const q = question as DiagnosisQuestion | undefined
      const a = answer as DiagnosisAnswer | undefined
      valid = isNonEmptyString(q?.prompt)
        && isNonEmptyString(q?.scenario)
        && isNonEmptyString(a?.expected)
        && (a.acceptable === undefined || isStringArray(a.acceptable, 0))
    } else if (type === 'sequence') {
      const q = question as SequenceQuestion | undefined
      const a = answer as SequenceAnswer | undefined
      valid = isNonEmptyString(q?.prompt)
        && isStringArray(q?.items, 2)
        && Array.isArray(a?.order)
        && isStringArray(a.order, 2)
        && isPermutation(q.items, a.order)
    } else if (type === 'enumeration') {
      const q = question as DiagnosisQuestion | undefined
      const a = answer as EnumerationAnswer | undefined
      if (isNonEmptyString(q?.prompt) && Array.isArray(a?.items)) {
        const requestedCount = getEnumerationPromptCount(q.prompt)
        if (requestedCount !== null && requestedCount !== a.items.length) {
          return invalidItem(index, type, `prompt requests ${requestedCount} items but answer contains ${a.items.length}`)
        }
      }
      valid = isNonEmptyString(q?.prompt)
        && a !== undefined
        && isStringArray(a.items)
        && new Set(a.items.map(normalized)).size === a.items.length
    } else if (type === 'flashcard_drill') {
      const q = question as McqQuestion | undefined
      const a = answer as DiagnosisAnswer | undefined
      valid = isNonEmptyString(q?.stem) && isNonEmptyString(a?.expected)
    }

    if (!valid) return invalidItem(index, type, 'question or answer fields are missing or inconsistent')

    return {
      type,
      subject,
      board_program: boardProgram,
      question: question as PracticeItem['question'],
      answer: answer as PracticeItem['answer'],
      rationale: typeof rationale === 'string' ? rationale.trim() || null : null,
    }
  })
}
