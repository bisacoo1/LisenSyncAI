import { describe, expect, it } from 'vitest'
import { computeBulkStatsUpdate, computeSubjectStats, getLevelProgress, getSubjectDailyTrend, summarizePracticeDays } from '../src/lib/analytics'
import type { Attempt, Profile, UserSubject } from '../src/types'
import { groupReviewersByFolder } from '../src/lib/reviewerFolders'

describe('profile progress calculation', () => {
  it('builds a daily subject trend with empty dates and ignores other subjects', () => {
    const makeAttempt = (subject: string, created_at: string, is_correct: boolean): Attempt => ({
      user_id: 'user',
      practice_item_id: null,
      board_program: 'pharmacy',
      subject,
      type: 'mcq',
      user_response: null,
      is_correct,
      created_at,
    })

    expect(getSubjectDailyTrend([
      makeAttempt('Pharmacology', '2026-11-19T10:00:00', true),
      makeAttempt('Pharmacology', '2026-11-19T14:00:00', false),
      makeAttempt('Anatomy', '2026-11-20T10:00:00', true),
      makeAttempt('Pharmacology', '2026-11-16T10:00:00', true),
    ], 'Pharmacology', 3, new Date(2026, 10, 20))).toEqual([
      { date: '2026-11-18', total: 0, correct: 0, percent: null },
      { date: '2026-11-19', total: 2, correct: 1, percent: 50 },
      { date: '2026-11-20', total: 0, correct: 0, percent: null },
    ])
  })

  it('combines all subjects into weighted daily practice summaries', () => {
    expect(summarizePracticeDays([
      {
        subject: 'Pharmacology',
        points: [
          { date: '2026-11-19', total: 2, correct: 1, percent: 50 },
          { date: '2026-11-20', total: 0, correct: 0, percent: null },
        ],
      },
      {
        subject: 'Anatomy',
        points: [
          { date: '2026-11-19', total: 1, correct: 1, percent: 100 },
          { date: '2026-11-20', total: 1, correct: 0, percent: 0 },
        ],
      },
    ])).toEqual([
      { date: '2026-11-20', correct: 0, total: 1, subjects: 1, percent: 0 },
      { date: '2026-11-19', correct: 2, total: 3, subjects: 2, percent: 66.7 },
    ])
  })

  it('marks practiced subjects below the passing target as weak spots', () => {
    const makeAttempt = (subject: string, is_correct: boolean): Attempt => ({
      user_id: 'user',
      practice_item_id: null,
      board_program: 'pharmacy',
      subject,
      type: 'mcq',
      user_response: null,
      is_correct,
      created_at: '2026-11-20T10:00:00',
    })

    const stats = computeSubjectStats([
      ...Array.from({ length: 3 }, () => makeAttempt('Below target', true)),
      ...Array.from({ length: 2 }, () => makeAttempt('Below target', false)),
      ...Array.from({ length: 3 }, () => makeAttempt('At target', true)),
      makeAttempt('At target', false),
    ], ['Below target', 'At target', 'Not practiced'])

    expect(stats.filter(subject => subject.weak && subject.total > 0).map(subject => subject.subject))
      .toEqual(['Below target'])
  })

  it('calculates XP, level, daily count, and consecutive-day streak from one snapshot', () => {
    const profile: Profile = {
      id: 'user',
      full_name: null,
      board_program: 'pharmacy',
      xp: 90,
      level: 1,
      current_streak: 5,
      longest_streak: 5,
      last_activity_date: '2026-11-18',
      daily_goal_date: '2026-11-18',
      daily_items_completed: 3,
    }

    expect(computeBulkStatsUpdate(profile, 1, 2, '2026-11-18')).toMatchObject({
      xp: 102,
      level: 2,
      current_streak: 5,
      longest_streak: 5,
      daily_items_completed: 5,
    })
  })

  it('increases XP required at each level and reports progress to the next level', () => {
    expect(getLevelProgress(534)).toEqual({
      level: 3,
      xpIntoLevel: 234,
      xpRequired: 300,
      xpRemaining: 66,
      progressPercent: 78,
    })
    expect(getLevelProgress(300)).toMatchObject({
      level: 3,
      xpIntoLevel: 0,
      xpRequired: 300,
      xpRemaining: 300,
    })
    expect(getLevelProgress(600)).toMatchObject({
      level: 4,
      xpIntoLevel: 0,
      xpRequired: 400,
    })
  })

  it('recalculates legacy levels using cumulative XP thresholds', () => {
    const profile: Profile = {
      id: 'user',
      full_name: null,
      board_program: 'pharmacy',
      xp: 598,
      level: 6,
    }

    expect(computeBulkStatsUpdate(profile, 1, 1, '2026-11-20')).toMatchObject({
      xp: 608,
      level: 4,
    })
  })

  it('resets a streak after a missed day', () => {
    const profile: Profile = {
      id: 'user',
      full_name: null,
      board_program: 'pharmacy',
      current_streak: 8,
      last_activity_date: '2026-11-15',
    }

    expect(computeBulkStatsUpdate(profile, 0, 1, '2026-11-18').current_streak).toBe(1)
  })
})

describe('reviewer subject folders', () => {
  it('groups moved reviewers by folder and keeps empty user folders visible', () => {
    const folders: UserSubject[] = [
      { id: 'folder-1', user_id: 'user', name: 'Pharmacology' },
      { id: 'folder-2', user_id: 'user', name: 'Empty subject' },
    ]
    const reviewers = [
      { id: 'material-1', folderName: 'Pharmacology' },
      { id: 'material-2', folderName: 'Pharmacology' },
    ]

    expect(groupReviewersByFolder(reviewers, folders)).toEqual([
      { id: 'folder-2', subject: 'Empty subject', reviewers: [] },
      { id: 'folder-1', subject: 'Pharmacology', reviewers },
    ])
  })
})
