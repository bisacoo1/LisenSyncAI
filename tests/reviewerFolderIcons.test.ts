import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('subject folder icons', () => {
  it('uses a folder icon for subject folders without changing study mode icons', () => {
    const page = readFileSync('src/pages/MyReviewersPage.tsx', 'utf8')
    const icons = readFileSync('src/components/ui/Icon.tsx', 'utf8')
    expect(icons).toContain('folder: Folder')
    expect(page).toContain('className="reviewer-folder-icon"><Icon name="folder"')
    expect(page).toContain("title: 'Study Mode', description: 'Review flashcards and check your recall.', icon: 'book-open'")
  })
})
