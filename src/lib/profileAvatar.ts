import { supabase } from './supabase'

export const PROFILE_AVATAR_BUCKET = 'profile-avatars'
export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024

const PROFILE_AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function assertProfileAvatarFile(file: Pick<File, 'type' | 'size'>) {
  if (!PROFILE_AVATAR_TYPES[file.type]) {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
  if (file.size === 0) {
    throw new Error('The selected image is empty.')
  }
  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    throw new Error('Images must be 5MB or smaller.')
  }
}

export async function uploadProfileAvatar(userId: string, file: File) {
  assertProfileAvatarFile(file)
  const path = `${userId}/${crypto.randomUUID()}.${PROFILE_AVATAR_TYPES[file.type]}`
  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeProfileAvatar(path: string) {
  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
