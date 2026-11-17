export interface PracticeReviewAttempt {
  practice_item_id: string | null
  is_correct: boolean
  created_at: string | null
}

export interface PracticeReviewQueueItem {
  practice_item_id: string
  incorrect_streak: number
  next_review_at: string
}

const REVIEW_INTERVALS = [
  10 * 60_000,
  24 * 60 * 60_000,
  3 * 24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
]

function sortQueue(queue: PracticeReviewQueueItem[]) {
  return queue.sort((a, b) => Date.parse(a.next_review_at) - Date.parse(b.next_review_at))
}

export function buildPracticeReviewQueue(
  attempts: PracticeReviewAttempt[],
  now = new Date(),
): PracticeReviewQueueItem[] {
  const states = new Map<string, {
    latestIncorrect: boolean
    latestAttemptAt: number
    incorrectStreak: number
    countStreak: boolean
  }>()

  for (const attempt of attempts) {
    if (!attempt.practice_item_id) continue
    const state = states.get(attempt.practice_item_id)
    if (!state) {
      const parsedTime = attempt.created_at ? Date.parse(attempt.created_at) : NaN
      states.set(attempt.practice_item_id, {
        latestIncorrect: !attempt.is_correct,
        latestAttemptAt: Number.isFinite(parsedTime) ? parsedTime : now.getTime(),
        incorrectStreak: attempt.is_correct ? 0 : 1,
        countStreak: !attempt.is_correct,
      })
      continue
    }

    if (!state.countStreak) continue
    if (attempt.is_correct) state.countStreak = false
    else state.incorrectStreak += 1
  }

  const queue = [...states.entries()]
    .filter(([, state]) => state.latestIncorrect)
    .map(([practiceItemId, state]) => {
      const interval = REVIEW_INTERVALS[Math.min(state.incorrectStreak - 1, REVIEW_INTERVALS.length - 1)]
      return {
        practice_item_id: practiceItemId,
        incorrect_streak: state.incorrectStreak,
        next_review_at: new Date(state.latestAttemptAt + interval).toISOString(),
      }
    })

  return sortQueue(queue)
}

export function updatePracticeReviewQueue(
  queue: PracticeReviewQueueItem[],
  practiceItemId: string,
  isCorrect: boolean,
  now = new Date(),
): PracticeReviewQueueItem[] {
  if (isCorrect) {
    return queue.filter(item => item.practice_item_id !== practiceItemId)
  }

  const previous = queue.find(item => item.practice_item_id === practiceItemId)
  const incorrectStreak = (previous?.incorrect_streak ?? 0) + 1
  const interval = REVIEW_INTERVALS[Math.min(incorrectStreak - 1, REVIEW_INTERVALS.length - 1)]
  const updated = queue.filter(item => item.practice_item_id !== practiceItemId)

  updated.push({
    practice_item_id: practiceItemId,
    incorrect_streak: incorrectStreak,
    next_review_at: new Date(now.getTime() + interval).toISOString(),
  })

  return sortQueue(updated)
}
