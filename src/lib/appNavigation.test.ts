import { describe, expect, it } from 'vitest'
import { findAppDestination } from './appNavigation'

describe('findAppDestination', () => {
  it('finds the requested section and gives a direct link', () => {
    expect(findAppDestination('Where can I find my badges?')).toMatchObject({
      title: 'Achievements',
      path: '/achievements',
    })
    expect(findAppDestination('How to upload a reviewer and which files are supported?')).toMatchObject({
      title: 'Upload materials',
      path: '/reviewer?tab=upload',
    })
    expect(findAppDestination('Where can I see the weekly leaderboard?')).toMatchObject({
      title: 'Leaderboards',
      path: '/leaderboard',
    })
    expect(findAppDestination('Open my friend requests')).toMatchObject({
      title: 'Friends',
      path: '/friends',
    })
  })

  it('does not navigate when the user is asking about a feature', () => {
    expect(findAppDestination('What achievements can I earn?')).toBeNull()
  })
})
