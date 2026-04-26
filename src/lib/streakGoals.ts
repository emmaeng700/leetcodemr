/** Same rules as `syncStreakActivityFromGoals` / notify-daily: active daily block fully solved and zero SR due. */

import { diffDaysSincePlanStart, normalizeStudyPlanRow, type StudyPlanForStreak } from './studyPlanDay'

export type { StudyPlanForStreak }
export { normalizeStudyPlanRow } from './studyPlanDay'

function buildSolvedSet(progress: Record<string, { solved?: boolean } | undefined>) {
  const solvedSet = new Set<number>()
  for (const [id, row] of Object.entries(progress)) {
    if (row?.solved) solvedSet.add(Number(id))
  }
  return solvedSet
}

/** goalsMet: day is done when all due reviews are cleared. streakNumber counts consecutive done days. */
function computePlanStreakCore(
  plan: StudyPlanForStreak,
  _progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  _reviewsCompletedToday = 0,
): { goalsMet: boolean; streakNumber: number } {
  const diffDaysRaw = diffDaysSincePlanStart(plan.start_date)
  const diffDays = Number.isFinite(diffDaysRaw) ? diffDaysRaw : 0

  if (diffDays < 0) {
    return { goalsMet: false, streakNumber: 0 }
  }

  const goalsMet = dueReviewCount === 0
  const streakNumber = diffDays + (goalsMet ? 1 : 0)

  return { goalsMet, streakNumber }
}

export function computeDailyGoalsMetToday(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  reviewsCompletedToday = 0,
): boolean {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return false
  return computePlanStreakCore(p, progress, dueReviewCount, reviewsCompletedToday).goalsMet
}

/** Headline streak when a study plan exists: completed “police” days in order (not activity_log). */
export function computePlanStreakDisplayNumber(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  reviewsCompletedToday = 0,
): number | null {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return null
  return computePlanStreakCore(p, progress, dueReviewCount, reviewsCompletedToday).streakNumber
}
