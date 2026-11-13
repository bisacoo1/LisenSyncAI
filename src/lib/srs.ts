// SM-2 inspired spaced repetition scheduler for flashcards.
// Intervals are stored in minutes so short "again" intervals are possible.

export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy'

const QUALITY_SCORE: Record<ReviewQuality, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface SrsState {
  ease_factor?: number | null
  interval_minutes?: number | null
  repetitions?: number | null
}

export interface SrsSchedule {
  ease_factor: number
  interval_minutes: number
  repetitions: number
  next_review_at: string
  last_reviewed_at: string
  last_quality: number
}

export function isCardDue(card: SrsState, now = new Date()): boolean {
  const next = (card as { next_review_at?: string | null }).next_review_at
  if (!next) return true
  return new Date(next).getTime() <= now.getTime()
}

export function scheduleReview(card: SrsState & { next_review_at?: string | null }, quality: ReviewQuality, now = new Date()): SrsSchedule {
  const q = QUALITY_SCORE[quality]
  let ease = card.ease_factor ?? 2.5
  let intervalMin = card.interval_minutes ?? 0
  let reps = card.repetitions ?? 0

  // SM-2 ease factor update: q in 0..5, q<3 means failure
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  let intervalMs: number
  if (q < 3) {
    // Failed recall: reset progress, review again soon
    reps = 0
    intervalMs = 10 * MINUTE
  } else {
    reps += 1
    if (reps === 1) {
      intervalMs = quality === 'easy' ? 4 * DAY : quality === 'hard' ? 12 * HOUR : DAY
    } else {
      // Grow the previous interval (stored in minutes) by the ease factor
      intervalMs = Math.max(intervalMin * ease * MINUTE, DAY)
    }
    if (quality === 'hard') intervalMs = Math.max(intervalMs * 0.6, DAY / 2)
    if (quality === 'easy') intervalMs = intervalMs * 1.3
  }

  intervalMin = Math.round(intervalMs / MINUTE)

  return {
    ease_factor: Math.round(ease * 100) / 100,
    interval_minutes: intervalMin,
    repetitions: reps,
    next_review_at: new Date(now.getTime() + intervalMs).toISOString(),
    last_reviewed_at: now.toISOString(),
    last_quality: q,
  }
}
