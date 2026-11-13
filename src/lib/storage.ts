import { supabase } from './supabase'

export const REVIEW_BUCKET = 'review-materials'
export const MAX_REVIEW_FILE_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
])

export function assertReviewFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Only PDF, DOCX, and PPT/PPTX files are supported.')
  }
  if (file.size > MAX_REVIEW_FILE_BYTES) {
    throw new Error('File must be 10MB or smaller.')
  }
}

export async function uploadReviewFile(userId: string, file: File): Promise<string> {
  assertReviewFile(file)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'review-file'
  const path = `${userId}/${crypto.randomUUID()}/${safeName}`
  const { error } = await supabase.storage.from(REVIEW_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeReviewFile(path: string) {
  await supabase.storage.from(REVIEW_BUCKET).remove([path])
}
