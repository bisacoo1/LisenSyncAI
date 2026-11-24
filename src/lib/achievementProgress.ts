import type { Attempt, Flashcard, PracticeItem, ReviewMaterial, StudyTrack, UserSubject } from '@/types'

export type AchievementProgressId =
  | 'study-consistency'
  | 'otc-error-recovery'
  | 'compounding-math'
  | 'pharmacology-micro'
  | 'medchem-kinetics'
  | 'clinical-therapeutics'
  | 'course-mastery'

export interface AchievementProgress {
  percentage: number
  detail: string
}

type ProgressAttempt = Pick<Attempt, 'practice_item_id' | 'type' | 'is_correct' | 'created_at'>
type ProgressFlashcard = Pick<Flashcard, 'material_id' | 'last_reviewed_at'>
type ProgressPracticeItem = Pick<PracticeItem, 'id' | 'material_id' | 'subject' | 'type'>
type ProgressMaterial = Pick<ReviewMaterial, 'id' | 'title' | 'subject' | 'subject_folder_id'>
type ProgressSubject = Pick<UserSubject, 'id' | 'name'>

export interface AchievementProgressInput {
  attempts: ProgressAttempt[]
  flashcards: ProgressFlashcard[]
  practiceItems: ProgressPracticeItem[]
  reviewMaterials: ProgressMaterial[]
  subjects: ProgressSubject[]
  completedModesByMaterial: Record<string, string[]>
  currentStreakDays: number
  track: StudyTrack
}

const topicTerms = {
  compounding: ['pharmaceutics', 'compounding', 'dosage form', 'calculation', 'mathematics'],
  pharmacology: [
    'pharmacology',
    'pharmacokinetic',
    'microbiology',
    'antimicrobial',
    'mechanism of action',
    'lab diagnostic',
    'quality assurance',
    'quality control',
  ],
  medchem: ['medicinal chemistry', 'pharmaceutical chemistry', 'medchem', 'pharmacokinetic', 'drug interaction'],
  clinical: ['clinical', 'therapeutic', 'practice of pharmacy', 'patient care', 'pharmacy practice'],
} as const

const courseStudyModes = new Set(['flashcards', 'mcq', 'identification', 'enumeration'])
const boardStudyModes = new Set(['flashcards', 'mcq', 'diagnosis', 'sequence'])

function percentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function calculateAchievementProgress(input: AchievementProgressInput): Record<AchievementProgressId, AchievementProgress> {
  const materialsById = new Map(input.reviewMaterials.map(material => [material.id, material]))
  const subjectsById = new Map(input.subjects.map(subject => [subject.id, subject.name]))
  const itemsById = new Map(input.practiceItems.map(item => [item.id, item]))
  const topicTextByItem = new Map(input.practiceItems.map(item => {
    const material = item.material_id ? materialsById.get(item.material_id) : undefined
    const folder = material?.subject_folder_id ? subjectsById.get(material.subject_folder_id) : undefined
    return [item.id, [item.subject, material?.subject, material?.title, folder].filter(Boolean).join(' ').toLowerCase()]
  }))
  const matchesTopic = (itemId: string, terms: readonly string[]) => {
    const text = topicTextByItem.get(itemId) || ''
    return terms.some(term => text.includes(term))
  }
  const chronologicalAttempts = [...input.attempts].sort((a, b) =>
    (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0)
  )
  const attemptsByItem = new Map<string, ProgressAttempt[]>()
  const latestAttemptByItem = new Map<string, ProgressAttempt>()
  for (const attempt of chronologicalAttempts) {
    if (!attempt.practice_item_id) continue
    const previous = attemptsByItem.get(attempt.practice_item_id) || []
    previous.push(attempt)
    attemptsByItem.set(attempt.practice_item_id, previous)
    latestAttemptByItem.set(attempt.practice_item_id, attempt)
  }

  let recoveredQuestions = 0
  for (const questionAttempts of attemptsByItem.values()) {
    let previouslyMissed = false
    for (const attempt of questionAttempts) {
      if (!attempt.is_correct) previouslyMissed = true
      else if (previouslyMissed) {
        recoveredQuestions += 1
        break
      }
    }
  }

  const correctlyAnswered = (topic: keyof typeof topicTerms) => {
    let count = 0
    for (const [itemId, questionAttempts] of attemptsByItem) {
      if (matchesTopic(itemId, topicTerms[topic]) && questionAttempts.some(attempt => attempt.is_correct)) count += 1
    }
    return count
  }

  const attemptedQuestions = (topic: keyof typeof topicTerms) => {
    let count = 0
    for (const itemId of attemptsByItem.keys()) {
      if (matchesTopic(itemId, topicTerms[topic])) count += 1
    }
    return count
  }

  const mcqStats = (topic: 'pharmacology' | 'medchem') => {
    let answered = 0
    let correct = 0
    for (const [itemId, attempt] of latestAttemptByItem) {
      if (itemsById.get(itemId)?.type !== 'mcq' || !matchesTopic(itemId, topicTerms[topic])) continue
      answered += 1
      if (attempt.is_correct) correct += 1
    }
    return { answered, correct, accuracy: answered ? (correct / answered) * 100 : 0 }
  }

  const pharmacology = mcqStats('pharmacology')
  const medchem = mcqStats('medchem')
  const compoundingQuestionsCorrect = correctlyAnswered('compounding')
  const clinicalQuestionsAttempted = attemptedQuestions('clinical')
  const streakDays = Math.max(0, Math.floor(input.currentStreakDays || 0))
  const reviewedCards = input.flashcards.filter(card => card.last_reviewed_at).length
  const studyProgress = (
    Math.min(streakDays, 14) / 14
    + Math.min(reviewedCards, 300) / 300
  ) / 2
  const topicQuestionProgress = (answered: number, accuracy: number, targetAccuracy: number) =>
    Math.min(100, (answered / 10) * 100, (accuracy / targetAccuracy) * 100)

  const modesByMaterial = new Map<string, Set<string>>()
  const allowedModes = input.track === 'course' ? courseStudyModes : boardStudyModes
  for (const item of input.practiceItems) {
    if (!item.material_id || !allowedModes.has(item.type)) continue
    const modes = modesByMaterial.get(item.material_id) || new Set<string>()
    modes.add(item.type)
    modesByMaterial.set(item.material_id, modes)
  }
  for (const card of input.flashcards) {
    if (!card.material_id) continue
    const modes = modesByMaterial.get(card.material_id) || new Set<string>()
    modes.add('flashcards')
    modesByMaterial.set(card.material_id, modes)
  }
  let totalStudyModes = 0
  let completedStudyModes = 0
  let reviewersWithStudyModes = 0
  for (const material of input.reviewMaterials) {
    const modes = modesByMaterial.get(material.id)
    if (!modes?.size) continue
    reviewersWithStudyModes += 1
    const completed = new Set(input.completedModesByMaterial[material.id] || [])
    for (const mode of modes) {
      totalStudyModes += 1
      if (completed.has(mode)) completedStudyModes += 1
    }
  }

  return {
    'study-consistency': {
      percentage: percentage(studyProgress * 100),
      detail: `${Math.min(streakDays, 14)} / 14 study days · ${Math.min(reviewedCards, 300)} / 300 flashcards reviewed`,
    },
    'otc-error-recovery': {
      percentage: percentage((recoveredQuestions / 50) * 100),
      detail: `${Math.min(recoveredQuestions, 50)} / 50 previously missed questions answered correctly`,
    },
    'compounding-math': {
      percentage: percentage((compoundingQuestionsCorrect / 30) * 100),
      detail: `${Math.min(compoundingQuestionsCorrect, 30)} / 30 reviewer questions answered correctly`,
    },
    'pharmacology-micro': {
      percentage: percentage(topicQuestionProgress(pharmacology.answered, pharmacology.accuracy, 90)),
      detail: `${pharmacology.correct} / ${pharmacology.answered} MCQs correct · 90% accuracy target`,
    },
    'medchem-kinetics': {
      percentage: percentage(topicQuestionProgress(medchem.answered, medchem.accuracy, 100)),
      detail: `${medchem.correct} / ${medchem.answered} MCQs correct · 100% accuracy target`,
    },
    'clinical-therapeutics': {
      percentage: percentage((clinicalQuestionsAttempted / 25) * 100),
      detail: `${Math.min(clinicalQuestionsAttempted, 25)} / 25 reviewer questions answered`,
    },
    'course-mastery': {
      percentage: totalStudyModes ? percentage((completedStudyModes / totalStudyModes) * 100) : 0,
      detail: totalStudyModes
        ? `${completedStudyModes} / ${totalStudyModes} available study modes completed across ${reviewersWithStudyModes} reviewer${reviewersWithStudyModes === 1 ? '' : 's'}`
        : 'Upload a reviewer and generate study sets to start progress',
    },
  }
}
