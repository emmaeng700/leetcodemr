/** Per-question daily rep counts for Set 2/3 practice daily (Chicago day, localStorage). */

import { notifyDailyRepsChanged } from '@/lib/dailyCompletion'
import { todayISOChicago } from '@/lib/studyPlanDay'
import type { ReviewSet } from '@/lib/setReviewFlow'

function repsKey(set: ReviewSet) {
  return `lm_set${set}_daily_reps`
}

function dateKey(set: ReviewSet) {
  return `lm_set${set}_daily_reps_date`
}

export function readSetDailyReps(set: ReviewSet): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    if (localStorage.getItem(dateKey(set)) !== todayISOChicago()) return {}
    return JSON.parse(localStorage.getItem(repsKey(set)) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function getSetDailyRepCount(
  id: number,
  setDailyReps: Record<string, number>,
): number {
  return setDailyReps[String(id)] ?? 0
}

export function isSetQuestionDoneForDailyToday(
  id: number,
  setDailyReps: Record<string, number>,
  repsPerQ: number,
): boolean {
  return getSetDailyRepCount(id, setDailyReps) >= repsPerQ
}

export function writeSetDailyRep(set: ReviewSet, questionId: number, count: number) {
  if (typeof window === 'undefined') return
  const today = todayISOChicago()
  const map = readSetDailyReps(set)
  map[String(questionId)] = count
  localStorage.setItem(dateKey(set), today)
  localStorage.setItem(repsKey(set), JSON.stringify(map))
  notifyDailyRepsChanged()
}

export function setDailyRepsFromStorage(set: ReviewSet): Record<string, number> {
  return readSetDailyReps(set)
}
