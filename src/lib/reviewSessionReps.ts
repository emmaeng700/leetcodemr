/** Per-question rep counts for the current review queue session (not lifetime mastery). */

export const REVIEW_SESSION_REPS_KEY = 'lm_review_reps'

export function readReviewSessionReps(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(REVIEW_SESSION_REPS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function writeReviewSessionRep(questionId: number, count: number) {
  if (typeof window === 'undefined') return
  const map = readReviewSessionReps()
  map[String(questionId)] = count
  sessionStorage.setItem(REVIEW_SESSION_REPS_KEY, JSON.stringify(map))
}

export function clearReviewSessionReps() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(REVIEW_SESSION_REPS_KEY)
}
