import { describe, expect, it } from 'vitest'
import type { Attempt, SubjectStat } from '@/types'
import { buildCoursePracticePaths, computeSubjectStats, mapCourseAttemptSubjectsToFolders, selectDailyRoadmapSubject } from './analytics'

describe('mapCourseAttemptSubjectsToFolders', () => {
  it('uses the material folder for course attempts while preserving unlinked subjects', () => {
    const attempts: Attempt[] = [
      {
        user_id: 'user-1',
        practice_item_id: 'item-1',
        board_program: 'pharmacy',
        subject: 'General',
        type: 'mcq',
        user_response: {},
        is_correct: true,
      },
      {
        user_id: 'user-1',
        practice_item_id: null,
        board_program: 'pharmacy',
        subject: 'General',
        type: 'mcq',
        user_response: {},
        is_correct: false,
      },
    ]

    const mapped = mapCourseAttemptSubjectsToFolders(
      attempts,
      [{ id: 'item-1', material_id: 'material-1' }],
      [{ id: 'material-1', subject: 'General', subject_folder_id: 'folder-1' }],
      [{ id: 'folder-1', name: 'Anatomy' }]
    )

    expect(mapped.map(attempt => attempt.subject)).toEqual(['Anatomy', 'General'])
  })
})
describe('buildCoursePracticePaths', () => {
  it('routes a folder subject to its material subject and available practice mode', () => {
    const paths = buildCoursePracticePaths(
      [{ id: 'material-1', subject: 'Pharmacology', subject_folder_id: 'folder-1' }],
      [{ material_id: 'material-1', type: 'identification' }],
      [],
      [{ id: 'folder-1', name: 'General' }]
    )

    expect(paths.General).toBe('/practice?mode=identification&subject=Pharmacology&material=material-1&folder=General')
  })
})

describe('selectDailyRoadmapSubject', () => {
  it('keeps today’s selected course subject when another subject becomes weaker', () => {
    const subjects: SubjectStat[] = [
      { subject: 'General', correct: 80, total: 103, percent: 77.7, weak: false },
      { subject: 'Anatomy', correct: 17, total: 35, percent: 48.6, weak: true },
    ]

    expect(selectDailyRoadmapSubject(subjects, true, 70.3, 'General')?.subject).toBe('General')
    expect(selectDailyRoadmapSubject(subjects, true, 70.3)?.subject).toBe('Anatomy')
  })
})

describe('computeSubjectStats', () => {
  it('flags attempted subjects below 75% but not those exactly at the target', () => {
    const makeAttempt = (subject: string, is_correct: boolean): Attempt => ({
      user_id: 'user-1',
      practice_item_id: null,
      board_program: 'pharmacy',
      subject,
      type: 'mcq',
      user_response: {},
      is_correct,
    })
    const attempts = [
      makeAttempt('General', true),
      makeAttempt('General', false),
      makeAttempt('General', false),
      makeAttempt('Anatomy', true),
      makeAttempt('Anatomy', true),
      makeAttempt('Anatomy', true),
      makeAttempt('Anatomy', false),
    ]

    const stats = computeSubjectStats(attempts, ['General', 'Anatomy'])

    expect(stats.filter(subject => subject.total > 0 && subject.weak).map(subject => subject.subject)).toEqual(['General'])
  })
})
