import { describe, expect, it } from 'vitest'
import { calculateAchievementProgress } from './achievementProgress'

function attempt(practiceItemId: string, isCorrect: boolean, minute: number, type = 'mcq') {
  return {
    practice_item_id: practiceItemId,
    type,
    is_correct: isCorrect,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  }
}

describe('calculateAchievementProgress', () => {
  it('calculates streak, recovered questions, topic accuracy, and completed practice work', () => {
    const practiceItems = [
      { id: 'math-1', material_id: 'math', subject: 'Pharmaceutics', type: 'mcq' },
      { id: 'math-2', material_id: 'math', subject: 'Pharmaceutics', type: 'mcq' },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `pharm-${index}`,
        material_id: 'pharm',
        subject: 'Pharmacology-Pharmacokinetics',
        type: 'mcq' as const,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `medchem-${index}`,
        material_id: 'medchem',
        subject: 'Pharmaceutical Chemistry',
        type: 'mcq' as const,
      })),
      { id: 'clinical-1', material_id: 'clinical', subject: 'Practice of Pharmacy', type: 'identification' },
      { id: 'clinical-2', material_id: 'clinical', subject: 'Practice of Pharmacy', type: 'identification' },
    ] as const
    const attempts = [
      attempt('math-1', false, 0),
      attempt('math-1', true, 1),
      attempt('math-2', true, 2),
      ...Array.from({ length: 10 }, (_, index) => attempt(`pharm-${index}`, index < 9, index + 3)),
      ...Array.from({ length: 10 }, (_, index) => attempt(`medchem-${index}`, index < 9, index + 13)),
      attempt('clinical-1', false, 23, 'identification'),
      attempt('clinical-2', true, 24, 'identification'),
    ]
    const materials = [
      { id: 'math', title: 'Calculations', subject: 'Pharmaceutics', subject_folder_id: null },
      { id: 'pharm', title: 'Pharmacology', subject: 'Pharmacology-Pharmacokinetics', subject_folder_id: null },
      { id: 'medchem', title: 'Chemistry', subject: 'Pharmaceutical Chemistry', subject_folder_id: null },
      { id: 'clinical', title: 'Practice', subject: 'Practice of Pharmacy', subject_folder_id: null },
    ]

    const progress = calculateAchievementProgress({
      attempts,
      flashcards: Array.from({ length: 150 }, () => ({ material_id: 'math', last_reviewed_at: '2026-01-01' })),
      practiceItems: [...practiceItems],
      reviewMaterials: materials,
      subjects: [],
      completedModesByMaterial: {},
      currentStreakDays: 7,
      track: 'course',
    })

    expect(progress['study-consistency'].percentage).toBe(50)
    expect(progress['otc-error-recovery'].percentage).toBe(2)
    expect(progress['compounding-math'].percentage).toBe(7)
    expect(progress['pharmacology-micro'].percentage).toBe(100)
    expect(progress['medchem-kinetics'].percentage).toBe(90)
    expect(progress['clinical-therapeutics'].percentage).toBe(8)
  })

  it('counts only available, completed modes for each uploaded reviewer', () => {
    const progress = calculateAchievementProgress({
      attempts: [],
      flashcards: [{ material_id: 'course-review', last_reviewed_at: null }],
      practiceItems: [
        { id: 'mcq', material_id: 'course-review', subject: 'Course', type: 'mcq' },
        { id: 'identification', material_id: 'course-review', subject: 'Course', type: 'identification' },
        { id: 'board-only', material_id: 'course-review', subject: 'Course', type: 'diagnosis' },
      ],
      reviewMaterials: [
        { id: 'course-review', title: 'Course reviewer', subject: 'Course', subject_folder_id: 'course-folder' },
      ],
      subjects: [{ id: 'course-folder', name: 'Pharmacology' }],
      completedModesByMaterial: { 'course-review': ['flashcards', 'mcq'] },
      currentStreakDays: 0,
      track: 'course',
    })

    expect(progress['course-mastery']).toEqual({
      percentage: 67,
      detail: '2 / 3 available study modes completed across 1 reviewer',
    })
  })
})
