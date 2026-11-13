import { Attempt, PASSING_RATE, Profile, SubjectStat } from '@/types'

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
  if (!u) return false
  const candidates = [expected, ...acceptable].map(normalizeText)
  return candidates.some(c => c && (u === c || u.includes(c) || c.includes(u)))
}

export function checkSequence(userOrder: string[], correct: string[]) {
  if (userOrder.length !== correct.length) return false
  const nu = userOrder.map(normalizeText)
  const nc = correct.map(normalizeText)
  return nu.every((v, i) => v === nc[i])
}

export interface ProfileStatsUpdate {
  xp?: number
  level?: number
  current_streak?: number
  longest_streak?: number
  last_activity_date?: string
  daily_items_completed?: number
  daily_goal_date?: string
}

function streakFields(profile: Profile, today: string) {
  const lastDate = profile.last_activity_date
  const sameDay = lastDate === today
  let newStreak = sameDay ? (profile.current_streak || 0) : (profile.current_streak || 0) + 1

  if (!sameDay) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (lastDate && lastDate !== yesterday) {
      newStreak = 1
    }
  }

  return {
    current_streak: newStreak,
    longest_streak: Math.max(profile.longest_streak || 0, newStreak),
    last_activity_date: today,
  }
}

export function computeProfileStatsUpdate(
  profile: Profile,
  isCorrect: boolean,
  today: string
): ProfileStatsUpdate {
  return computeBulkStatsUpdate(profile, isCorrect ? 1 : 0, 1, today)
}

export function computeBulkStatsUpdate(
  profile: Profile,
  correct: number,
  total: number,
  today: string
): ProfileStatsUpdate {
  const xpGain = correct * 10 + Math.max(0, total - correct) * 2
  const newXp = (profile.xp || 0) + xpGain
  const newLevel = Math.floor(newXp / 100) + 1

  const dailyCompleted = profile.daily_goal_date === today
    ? (profile.daily_items_completed || 0) + total
    : total

  return {
    xp: newXp,
    level: newLevel,
    ...streakFields(profile, today),
    daily_items_completed: dailyCompleted,
    daily_goal_date: today,
  }
}
