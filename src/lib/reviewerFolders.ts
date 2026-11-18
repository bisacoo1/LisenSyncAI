import type { UserSubject } from '@/types'

export interface ReviewerFolder<T> {
  id: string | null
  subject: string
  reviewers: T[]
}

export function groupReviewersByFolder<T extends { folderName: string }>(
  reviewers: T[],
  subjectFolders: UserSubject[],
): ReviewerFolder<T>[] {
  const grouped = new Map<string, T[]>()
  for (const reviewer of reviewers) {
    const entries = grouped.get(reviewer.folderName) || []
    entries.push(reviewer)
    grouped.set(reviewer.folderName, entries)
  }
  for (const folder of subjectFolders) {
    if (!grouped.has(folder.name)) grouped.set(folder.name, [])
  }
  return Array.from(grouped.entries())
    .map(([subject, entries]) => ({
      id: subjectFolders.find(folder => folder.name === subject)?.id || null,
      subject,
      reviewers: entries,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject))
}
