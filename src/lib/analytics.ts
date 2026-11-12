import { Attempt, PASSING_RATE, SubjectStat } from '@/types'

export function computeSubjectStats(attempts: Attempt[], subjects: string[]): SubjectStat[] {
  const by: Record<string, { correct: number; total: number }> = {}
  subjects.forEach(s => (by[s] = { correct: 0, total: 0 }))
  for (const a of attempts) {
    if (!by[a.subject]) by[a.subject] = { correct: 0, total: 0 }
    by[a.subject].total += 1
    if (a.is_correct) by[a.subject].correct += 1
  }
  return subjects.map(subject => {
    const { correct, total } = by[subject] || { correct: 0, total: 0 }
    const percent = total ? Math.round((correct / total) * 1000) / 10 : 0
    return { subject, correct, total, percent, weak: total > 0 ? percent < PASSING_RATE : true }
  })
}

export function overallPercent(attempts: Attempt[]): number {
  if (!attempts.length) return 0
  const correct = attempts.filter(a => a.is_correct).length
  return Math.round((correct / attempts.length) * 1000) / 10
}

export function readinessLabel(percent: number): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  if (percent >= PASSING_RATE) return { label: 'On track (≥75%)', tone: 'ok' }
  if (percent >= 60) return { label: 'Developing (60–74%)', tone: 'warn' }
  return { label: 'Needs remediation (<60%)', tone: 'danger' }
}

export function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function checkDiagnosis(user: string, expected: string, acceptable: string[] = []) {
  const u = normalizeText(user)
  const candidates = [expected, ...acceptable].map(normalizeText)
  return candidates.some(c => c && (u === c || u.includes(c) || c.includes(u)))
}

export function checkSequence(userOrder: string[], correct: string[]) {
  if (userOrder.length !== correct.length) return false
  const nu = userOrder.map(normalizeText)
  const nc = correct.map(normalizeText)
  return nu.every((v, i) => v === nc[i])
}
