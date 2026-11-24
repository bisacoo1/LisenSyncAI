import { useEffect, useState } from 'react'
import mascotAvatar from '@/assets/mascot/lilo.png'
import bogsAvatar from '@/assets/mascot/bogs.png'
import dannaAvatar from '@/assets/mascot/danna.jpg'
import iyaAvatar from '@/assets/mascot/iya.jpg'
import jenAvatar from '@/assets/mascot/jen.jpg'
import nikaAvatar from '@/assets/mascot/nika.jpg'
import wenAvatar from '@/assets/mascot/wen.png'
import { Icon, type IconName } from '@/components/ui'
import { PROFILE_AVATAR_BORDERS } from '@/lib/avatarBorders'
import { PROFILE_AVATAR_BUCKET } from '@/lib/profileAvatar'
import { supabase } from '@/lib/supabase'

type Preset = { id: string; label: string; icon?: IconName; image?: string }

export const PROFILE_AVATAR_PRESETS = [
  { id: 'lilo', label: 'Lilo', image: mascotAvatar },
  { id: 'wen', label: 'Wen', image: wenAvatar },
  { id: 'flask', label: 'Jen', image: bogsAvatar },
  { id: 'leaf', label: 'Bogs', image: jenAvatar },
  { id: 'pill', label: 'Nika', image: nikaAvatar },
  { id: 'brain', label: 'Danna', image: dannaAvatar },
  { id: 'stethoscope', label: 'Iya', image: iyaAvatar },
] as const satisfies readonly Preset[]

export type ProfileAvatarId = 'initials' | (typeof PROFILE_AVATAR_PRESETS)[number]['id']

interface ProfileAvatarProps {
  avatarId?: string | null
  avatarPath?: string | null
  avatarBorderId?: string | null
  initials: string
  className: string
}

export function ProfileAvatar({ avatarId, avatarPath, avatarBorderId, initials, className }: ProfileAvatarProps) {
  const [signedUrl, setSignedUrl] = useState('')
  const preset: Preset | undefined = PROFILE_AVATAR_PRESETS.find(option => option.id === avatarId)
  const border = PROFILE_AVATAR_BORDERS.find(option => option.id === avatarBorderId) || PROFILE_AVATAR_BORDERS[0]

  useEffect(() => {
    let active = true
    setSignedUrl('')
    if (!avatarPath) return () => { active = false }

    const refreshUrl = async () => {
      const { data, error } = await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .createSignedUrl(avatarPath, 60 * 60)
      if (!active) return
      if (error) {
        console.error('Could not load profile avatar:', error.message)
        return
      }
      setSignedUrl(data.signedUrl)
    }

    void refreshUrl()
    const interval = window.setInterval(() => { void refreshUrl() }, 50 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [avatarPath])

  const image = avatarPath ? signedUrl : preset?.image
  return (
    <span
      className={`${className} profile-avatar-frame`}
      aria-hidden="true"
    >
      <span className={`profile-avatar profile-avatar--${preset?.id || 'initials'}`}>
        {image ? (
          <img src={image} alt="" onError={() => setSignedUrl('')} />
        ) : preset?.icon ? (
          <Icon name={preset.icon} size={22} />
        ) : (
          initials
        )}
      </span>
      {border?.image ? (
        <img className="profile-avatar-frame-image" src={border.image} alt="" />
      ) : border ? (
        <span className="profile-avatar-frame-circle" />
      ) : null}
    </span>
  )
}
