export interface StudyModeProgress {
  allComplete: boolean
  hasUncompletedAlternative: boolean
}

export const STUDY_MODE_VALUES = ['flashcards', 'mcq', 'diagnosis', 'sequence', 'enumeration', 'identification'] as const

export function isStudyMode(value: unknown): value is typeof STUDY_MODE_VALUES[number] {
  return typeof value === 'string' && STUDY_MODE_VALUES.some(mode => mode === value)
}

export function studyModeProgressKey(userId: string, materialId: string, subject: string) {
  return `pharmora-study-mode-progress:${userId}:${materialId || `subject-${encodeURIComponent(subject)}`}`
}

export function parseCompletedStudyModes(raw: string | null): string[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isStudyMode)) {
    throw new Error('Saved study mode progress is invalid.')
  }
  return [...new Set(parsed)]
}

export function getStudyModeProgress(
  availableModes: string[],
  completedModes: string[],
  currentMode: string,
  currentSessionComplete: boolean,
): StudyModeProgress {
  const completed = new Set(completedModes)
  return {
    allComplete: availableModes.length > 0 && availableModes.every(mode =>
      completed.has(mode) || (mode === currentMode && currentSessionComplete)
    ),
    hasUncompletedAlternative: availableModes.some(mode =>
      mode !== currentMode && !completed.has(mode)
    ),
  }
}
