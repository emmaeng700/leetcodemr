/** Per-question rep counts for today's review session (not lifetime mastery). */

import { todayISOChicago } from '@/lib/studyPlanDay'

export const REVIEW_SESSION_REPS_KEY = 'lm_review_reps'
const REVIEW_SESSION_DATE_KEY = 'lm_review_reps_date'

function todayKey() {
  return todayISOChicago()
}

export function readReviewSessionReps(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    if (localStorage.getItem(REVIEW_SESSION_DATE_KEY) !== todayKey()) return {}
    return JSON.parse(localStorage.getItem(REVIEW_SESSION_REPS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function writeReviewSessionRep(questionId: number, count: number) {
  if (typeof window === 'undefined') return
  const map = readReviewSessionReps()
  map[String(questionId)] = count
  localStorage.setItem(REVIEW_SESSION_DATE_KEY, todayKey())
  localStorage.setItem(REVIEW_SESSION_REPS_KEY, JSON.stringify(map))
}

export function clearReviewSessionReps() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(REVIEW_SESSION_REPS_KEY)
  localStorage.removeItem(REVIEW_SESSION_DATE_KEY)
}
