import { describe, expect, it } from 'vitest'
import { assertProfileAvatarFile, MAX_PROFILE_AVATAR_BYTES } from '../src/lib/profileAvatar'
import { PROFILE_AVATAR_BORDERS } from '../src/lib/avatarBorders'

const avatarFile = (type: string, size: number) => ({ type, size } as File)

describe('assertProfileAvatarFile', () => {
  it('accepts supported, non-empty images within the size limit', () => {
    expect(() => assertProfileAvatarFile(avatarFile('image/png', MAX_PROFILE_AVATAR_BYTES))).not.toThrow()
  })

  describe('profile avatar borders', () => {
    it('keeps the simple default circle and Capsule Specialist unlocked', () => {
      expect(PROFILE_AVATAR_BORDERS).toHaveLength(9)
      expect(PROFILE_AVATAR_BORDERS[0].label).toBe('Default Border')
      expect(PROFILE_AVATAR_BORDERS.filter(border => !border.locked).map(border => border.id))
        .toEqual(['default-circle', 'capsule-specialist'])
    })
  })

  it('rejects unsupported, empty, and oversized images', () => {
    expect(() => assertProfileAvatarFile(avatarFile('image/svg+xml', 100))).toThrow(/JPEG, PNG, or WebP/)
    expect(() => assertProfileAvatarFile(avatarFile('image/png', 0))).toThrow(/empty/)
    expect(() => assertProfileAvatarFile(avatarFile('image/jpeg', MAX_PROFILE_AVATAR_BYTES + 1))).toThrow(/5MB or smaller/)
  })
})
