import { describe, expect, it } from 'vitest'
import { checkDiagnosis, checkEnumeration } from '../src/lib/analytics'

describe('typed answer grading', () => {
  it('matches normalized answers and explicitly accepted alternatives', () => {
    expect(checkDiagnosis('  Aspirin  ', 'aspirin')).toBe(true)
    expect(checkDiagnosis('acetylsalicylic acid', 'aspirin', ['acetylsalicylic acid'])).toBe(true)
  })
  it('does not accept arbitrary substrings or contradictory answers', () => {
    expect(checkDiagnosis('a', 'aspirin')).toBe(false)
    expect(checkDiagnosis('not aspirin', 'aspirin')).toBe(false)
    expect(checkDiagnosis('asp', 'aspirin')).toBe(false)
  })
  it('requires each enumeration item to match, regardless of order', () => {
    expect(checkEnumeration('beta; alpha', ['alpha', 'beta'])).toBe(true)
    expect(checkEnumeration('a; beta', ['alpha', 'beta'])).toBe(false)
    expect(checkEnumeration('alpha; alpha', ['alpha', 'beta'])).toBe(false)
  })
})

describe('server grading migration', () => {
  it('uses exact normalized matches for practice and mock answers', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync('supabase/migrations/202611180002_exact_answer_grading.sql', 'utf8')
    expect(sql).toContain('function public.record_practice_attempt')
    expect(sql).toContain('function public.submit_mock_exam')
    expect(sql).not.toContain('or position(')
    expect(sql).toContain('v_user_text = public.normalize_answer_text(candidate.value)')
    expect(sql).toContain('public.normalize_answer_text(user_part.value) = public.normalize_answer_text(expected_part.value)')
  })
})
