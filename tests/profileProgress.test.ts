import { describe, expect, it } from 'vitest'
import { computeBulkStatsUpdate } from '../src/lib/analytics'
import type { Profile, UserSubject } from '../src/types'
import { groupReviewersByFolder } from '../src/lib/reviewerFolders'

describe('profile progress calculation', () => {
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
