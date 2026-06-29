/** Per-question rep counts for today's review session (not lifetime mastery). */

import { todayISOChicago } from '@/lib/studyPlanDay'

export const REVIEW_SESSION_REPS_KEY = 'lm_review_reps'
const REVIEW_SESSION_DATE_KEY = 'lm_review_reps_date'

function repsStorageKeys(reviewSet?: 2 | 3) {
  if (!reviewSet) {
    return { repsKey: REVIEW_SESSION_REPS_KEY, dateKey: REVIEW_SESSION_DATE_KEY }
  }
  return {
    repsKey: `${REVIEW_SESSION_REPS_KEY}_set${reviewSet}`,
    dateKey: `${REVIEW_SESSION_DATE_KEY}_set${reviewSet}`,
  }
}

function todayKey() {
  return todayISOChicago()
}

export function readReviewSessionReps(reviewSet?: 2 | 3): Record<string, number> {
  if (typeof window === 'undefined') return {}
  const { repsKey, dateKey } = repsStorageKeys(reviewSet)
  try {
    if (localStorage.getItem(dateKey) !== todayKey()) return {}
    return JSON.parse(localStorage.getItem(repsKey) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function writeReviewSessionRep(questionId: number, count: number, reviewSet?: 2 | 3) {
  if (typeof window === 'undefined') return
  const { repsKey, dateKey } = repsStorageKeys(reviewSet)
  const map = readReviewSessionReps(reviewSet)
  map[String(questionId)] = count
  localStorage.setItem(dateKey, todayKey())
  localStorage.setItem(repsKey, JSON.stringify(map))
}

export function clearReviewSessionReps(reviewSet?: 2 | 3) {
  if (typeof window === 'undefined') return
  const { repsKey, dateKey } = repsStorageKeys(reviewSet)
  localStorage.removeItem(repsKey)
  localStorage.removeItem(dateKey)
}
