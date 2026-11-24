import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { removeProfileAvatar, uploadProfileAvatar, assertProfileAvatarFile } from '@/lib/profileAvatar'
import { PROFILE_AVATAR_BORDERS, type ProfileAvatarBorder } from '@/lib/avatarBorders'
import { supabase } from '@/lib/supabase'
import { Button, Icon, Modal, useToast } from '@/components/ui'
import { PROFILE_AVATAR_PRESETS, ProfileAvatar, type ProfileAvatarId } from './ProfileAvatar'
import type { ProfileAvatarBorderId } from '@/types'

interface AccountAvatarPickerProps {
  open: boolean
  onClose: () => void
}
const avatarInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

export function AccountAvatarPicker({ open, onClose }: AccountAvatarPickerProps) {
  const { profile, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const initials = avatarInitials(profile?.full_name || 'Pharmacy candidate')
  const currentBorderId = profile?.avatar_border || 'default-circle'

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setFileError('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [open])

  const closePicker = () => {
    if (!saving) onClose()
  }

  async function saveAvatar(avatarId: ProfileAvatarId | null, file?: File) {
    if (!profile || saving) return
    const previousPath = profile.avatar_path || null
    let uploadedPath: string | null = null
    let profileUpdated = false
    setSaving(true)

    try {
      if (file) uploadedPath = await uploadProfileAvatar(profile.id, file)
      const { error } = await supabase.from('profiles').update({
        avatar_id: avatarId,
        avatar_path: uploadedPath,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id)
      if (error) throw new Error(error.message)
      profileUpdated = true
      await refreshProfile()
      onClose()
      addToast({
        type: 'success',
        title: 'Avatar updated',
        message: 'Your account photo has been saved.',
        duration: 2800,
        placement: 'center',
      })

      if (previousPath && previousPath !== uploadedPath) {
        try {
          await removeProfileAvatar(previousPath)
        } catch (cleanupError) {
          addToast({
            type: 'error',
            title: 'Could not remove your previous photo',
            message: cleanupError instanceof Error ? cleanupError.message : 'You can try again later.',
          })
        }
      }
    } catch (error) {
      if (uploadedPath && !profileUpdated) {
        try {
          await removeProfileAvatar(uploadedPath)
        } catch (cleanupError) {
          addToast({
            type: 'error',
            title: 'Could not clean up the new photo',
            message: cleanupError instanceof Error ? cleanupError.message : 'Please contact support.',
          })
        }
      }
      addToast({
        type: 'error',
        title: profileUpdated ? 'Avatar saved, but profile refresh failed' : 'Could not update avatar',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function saveBorder(borderId: ProfileAvatarBorderId) {
    if (!profile || saving) return
    let borderSaved = false
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        avatar_border: borderId,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id)
      if (error) throw new Error(error.message)
      borderSaved = true
      await refreshProfile()
      addToast({
        type: 'success',
        title: 'Avatar border updated',
        message: 'Your selected avatar border is now active.',
        duration: 2800,
        placement: 'center',
      })
    } catch (error) {
      addToast({
        type: 'error',
        title: borderSaved ? 'Avatar border saved, but profile refresh failed' : 'Could not update avatar border',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    try {
      assertProfileAvatarFile(file)
      setSelectedFile(file)
      setFileError('')
    } catch (error) {
      setSelectedFile(null)
      setFileError(error instanceof Error ? error.message : 'Choose a supported image.')
      event.currentTarget.value = ''
    }
  }

  return (
    <Modal
      open={open}
      onClose={closePicker}
      title="Choose your avatar"
      description="Pick a ready-made avatar, upload a photo, and choose an unlocked border. More borders will unlock through achievements."
      size="md"
      closeOnOverlayClick={!saving}
      closeOnEscape={!saving}
      footer={<Button variant="secondary" onClick={closePicker} disabled={saving}>Close</Button>}
      className="account-avatar-modal"
    >
      <div className="avatar-picker">
        <div className="avatar-picker-grid" role="group" aria-label="Ready-made avatars">
          <button
            type="button"
            className={`avatar-picker-option${!profile?.avatar_path && (profile?.avatar_id || 'initials') === 'initials' ? ' is-selected' : ''}`}
            aria-pressed={!profile?.avatar_path && (profile?.avatar_id || 'initials') === 'initials'}
            disabled={saving}
            onClick={() => void saveAvatar('initials')}
          >
            <ProfileAvatar avatarId="initials" initials={initials} avatarBorderId={currentBorderId} className="avatar-picker-preview" />
            <span>Initials</span>
          </button>
          {PROFILE_AVATAR_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`avatar-picker-option${!profile?.avatar_path && profile?.avatar_id === preset.id ? ' is-selected' : ''}`}
              aria-pressed={!profile?.avatar_path && profile?.avatar_id === preset.id}
              disabled={saving}
              onClick={() => void saveAvatar(preset.id)}
            >
              <ProfileAvatar avatarId={preset.id} initials={initials} avatarBorderId={currentBorderId} className="avatar-picker-preview" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        <section className="avatar-border-picker" aria-labelledby="avatar-border-heading">
          <div className="avatar-border-picker-heading">
            <h3 id="avatar-border-heading">Avatar borders</h3>
            <p id="avatar-border-lock-note">Unlock more frames by earning achievements.</p>
          </div>
          <div className="avatar-picker-grid" role="group" aria-label="Avatar borders">
            {PROFILE_AVATAR_BORDERS.map((border: ProfileAvatarBorder) => {
              const isSelected = currentBorderId === border.id
              return (
                <button
                  key={border.id}
                  type="button"
                  className={`avatar-picker-option avatar-border-option${isSelected ? ' is-selected' : ''}${border.locked ? ' is-locked' : ''}`}
                  aria-label={`${border.label}${border.locked ? '. Locked. Unlock by earning achievements.' : '. Unlocked.'}`}
                  aria-pressed={!border.locked && isSelected}
                  aria-describedby={border.locked ? 'avatar-border-lock-note' : undefined}
                  disabled={saving || border.locked}
                  onClick={() => void saveBorder(border.id)}
                >
                  <ProfileAvatar
                    avatarId={profile?.avatar_id}
                    initials={initials}
                    avatarBorderId={border.id}
                    className="avatar-picker-preview"
                  />
                  <span className="avatar-border-option-name">{border.label}</span>
                  <span className={`avatar-border-option-status${border.locked ? ' is-locked' : ''}`}>
                    <Icon name={border.locked ? 'lock' : 'check-circle'} size={13} aria-hidden="true" />
                    {border.locked ? 'Locked' : 'Unlocked'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="avatar-picker-upload">
          <div className="avatar-picker-upload-copy">
            <strong>Upload a custom photo</strong>
            <small>JPEG, PNG, or WebP · up to 5MB</small>
          </div>
          {previewUrl && (
            <img className="avatar-picker-upload-preview" src={previewUrl} alt="Preview of your selected photo" />
          )}
          <input
            ref={fileInputRef}
            className="avatar-picker-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose a profile photo"
            onChange={handleFileChange}
            disabled={saving}
          />
          <div className="avatar-picker-upload-actions">
            <Button
              variant="secondary"
              leftIcon="image"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {selectedFile ? 'Choose another photo' : 'Choose photo'}
            </Button>
            {selectedFile && (
              <Button
                variant="primary"
                leftIcon="save"
                onClick={() => void saveAvatar(null, selectedFile)}
                loading={saving}
              >
                Save photo
              </Button>
            )}
          </div>
          {fileError && <p className="avatar-picker-error" role="alert">{fileError}</p>}
        </div>
        {saving && <p className="avatar-picker-status" role="status"><Icon name="loader" size={15} /> Saving avatar…</p>}
      </div>
    </Modal>
  )
}
