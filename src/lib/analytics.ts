import { Attempt, Flashcard, PASSING_RATE, PracticeItem, Profile, ReviewMaterial, SubjectStat, UserSubject } from '@/types'

export function buildCoursePracticePaths(
  materials: Pick<ReviewMaterial, 'id' | 'subject' | 'subject_folder_id'>[],
  practiceItems: Pick<PracticeItem, 'material_id' | 'type'>[],
  flashcards: Pick<Flashcard, 'material_id'>[],
  folders: Pick<UserSubject, 'id' | 'name'>[]
): Record<string, string> {
  const folderNames = new Map(folders.map(folder => [folder.id, folder.name]))
  const modesByMaterial = new Map<string, Set<string>>()
  for (const card of flashcards) {
    if (!card.material_id) continue
    const modes = modesByMaterial.get(card.material_id) || new Set<string>()
    modes.add('flashcards')
    modesByMaterial.set(card.material_id, modes)
  }
  for (const item of practiceItems) {
    if (!item.material_id) continue
    const modes = modesByMaterial.get(item.material_id) || new Set<string>()
    modes.add(item.type)
    modesByMaterial.set(item.material_id, modes)
  }

  const paths: Record<string, string> = {}
  for (const material of materials) {
    const folderName = (material.subject_folder_id && folderNames.get(material.subject_folder_id)) || material.subject
    if (paths[folderName]) continue
    const modes = modesByMaterial.get(material.id)
    const mode = ['mcq', 'flashcards', 'identification', 'enumeration', 'diagnosis', 'sequence']
      .find(value => modes?.has(value))
    if (!mode) continue
    const params = new URLSearchParams({
      mode,
      subject: material.subject,
      material: material.id,
      folder: folderName,
    })
    paths[folderName] = `/practice?${params.toString()}`
  }
  return paths
}

export function mapCourseAttemptSubjectsToFolders(
  attempts: Attempt[],
  practiceItems: Pick<PracticeItem, 'id' | 'material_id'>[],
  materials: Pick<ReviewMaterial, 'id' | 'subject' | 'subject_folder_id'>[],
  folders: Pick<UserSubject, 'id' | 'name'>[]
): Attempt[] {
  const folderNames = new Map(folders.map(folder => [folder.id, folder.name]))
  const subjectsByMaterial = new Map(
    materials.map(material => [
      material.id,
      (material.subject_folder_id && folderNames.get(material.subject_folder_id)) || material.subject,
    ])
  )
  const subjectsByPracticeItem = new Map(
    practiceItems.map(item => [item.id, item.material_id ? subjectsByMaterial.get(item.material_id) : undefined])
  )

  return attempts.map(attempt => {
    const subject = attempt.practice_item_id
      ? subjectsByPracticeItem.get(attempt.practice_item_id)
      : undefined
    return subject ? { ...attempt, subject } : attempt
  })
}

export function selectDailyRoadmapSubject(
  subjectStats: SubjectStat[],
  isCourse: boolean,
  overall: number,
  savedSubject?: string
): SubjectStat | undefined {
  const saved = subjectStats.find(subject => subject.subject === savedSubject)
  if (saved) return saved

  const weak = subjectStats.filter(subject => subject.weak && subject.total > 0)
  const courseFocus = subjectStats
    .filter(subject => subject.total > 0 && subject.percent < overall)
    .sort((a, b) => a.percent - b.percent)

  return (isCourse ? courseFocus : weak)[0]
    || subjectStats.find(subject => subject.total === 0)
    || subjectStats.slice().sort((a, b) => a.percent - b.percent)[0]
}

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

export interface SubjectDailyTrendPoint {
  date: string
  total: number
  correct: number
  percent: number | null
}

export function getSubjectDailyTrend(
  attempts: Attempt[],
  subject: string,
  days = 14,
  today = new Date()
): SubjectDailyTrendPoint[] {
  const range = Math.max(1, Math.floor(days))
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - range + 1)
  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const byDay = new Map<string, { correct: number; total: number }>()

  for (const attempt of attempts) {
    if (attempt.subject !== subject || !attempt.created_at) continue
    const createdAt = new Date(attempt.created_at)
    if (Number.isNaN(createdAt.getTime())) continue
    const key = dateKey(createdAt)
    if (key < dateKey(start) || key > dateKey(end)) continue
    const day = byDay.get(key) || { correct: 0, total: 0 }
    day.total += 1
    if (attempt.is_correct) day.correct += 1
    byDay.set(key, day)
  }

  return Array.from({ length: range }, (_, index) => {
    const date = new Date(start)
    date.setDate(date.getDate() + index)
    const key = dateKey(date)
    const day = byDay.get(key)
    return {
      date: key,
      total: day?.total || 0,
      correct: day?.correct || 0,
      percent: day ? Math.round((day.correct / day.total) * 1000) / 10 : null,
    }
  })
}

export interface DailyPracticeSummary {
  date: string
  correct: number
  total: number
  subjects: number
  percent: number
}

export function summarizePracticeDays(
  trends: { subject: string; points: SubjectDailyTrendPoint[] }[]
): DailyPracticeSummary[] {
  const byDate = new Map<string, { correct: number; total: number; subjects: number }>()
  trends.forEach(trend => trend.points.forEach(day => {
    if (!day.total) return
    const summary = byDate.get(day.date) || { correct: 0, total: 0, subjects: 0 }
    summary.correct += day.correct
    summary.total += day.total
    summary.subjects += 1
    byDate.set(day.date, summary)
  }))

  return [...byDate.entries()]
    .map(([date, summary]) => ({
      date,
      ...summary,
      percent: Math.round((summary.correct / summary.total) * 1000) / 10,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
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

export interface LevelProgress {
  level: number
  xpIntoLevel: number
  xpRequired: number
  xpRemaining: number
  progressPercent: number
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0
  let level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 100)) / 2)
  let xpAtLevelStart = 50 * level * (level - 1)

  while (level > 1 && xp < xpAtLevelStart) {
    level -= 1
    xpAtLevelStart = 50 * level * (level - 1)
  }
  while (xp >= xpAtLevelStart + level * 100) {
    xpAtLevelStart += level * 100
    level += 1
  }

  const xpIntoLevel = xp - xpAtLevelStart
  const xpRequired = level * 100
  return {
    level,
    xpIntoLevel,
    xpRequired,
    xpRemaining: xpRequired - xpIntoLevel,
    progressPercent: Math.round((xpIntoLevel / xpRequired) * 1000) / 10,
  }
}

export function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function checkDiagnosis(user: string, expected: string, acceptable: string[] = []) {
  const u = normalizeText(user)
  if (!u) return false
  const candidates = [expected, ...acceptable].map(normalizeText)
  return candidates.some(c => c !== '' && u === c)
}

export function checkSequence(userOrder: string[], correct: string[]) {
  if (userOrder.length !== correct.length) return false
  const nu = userOrder.map(normalizeText)
  const nc = correct.map(normalizeText)
  return nu.every((v, i) => v === nc[i])
}

export function checkEnumeration(userInput: string, correctItems: string[]) {
  const userItems = userInput
    .split(/[\n,;]+/)
    .map(s => normalizeText(s))
    .filter(Boolean)
  const expected = correctItems.map(normalizeText).filter(Boolean)
  if (!userItems.length || userItems.length !== expected.length) return false
  const remaining = [...expected]
  for (const u of userItems) {
    const i = remaining.findIndex(e => e === u)
    if (i === -1) return false
    remaining.splice(i, 1)
  }
  return true
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
    const yesterday = new Date(new Date(`${today}T00:00:00.000Z`).getTime() - 86400000).toISOString().slice(0, 10)
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
  const newLevel = getLevelProgress(newXp).level

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
