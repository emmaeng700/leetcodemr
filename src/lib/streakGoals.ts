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

/** goalsMet + streakNumber: full daily+SR days completed in plan order (day 13 incomplete → 12). */
function computePlanStreakCore(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
): { goalsMet: boolean; streakNumber: number } {
  const solvedSet = buildSolvedSet(progress)

  const diffDays = diffDaysSincePlanStart(plan.start_date)
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)

  if (diffDays < 0) {
    return { goalsMet: false, streakNumber: 0 }
  }

  if (diffDays >= totalDays) {
    const allDone =
      plan.question_order.every(id => solvedSet.has(id)) && dueReviewCount === 0
    return {
      goalsMet: false,
      streakNumber: allDone ? totalDays : Math.max(0, totalDays - 1),
    }
  }

  let activeDayIndex = diffDays
  for (let i = 0; i <= diffDays; i++) {
    const ids: number[] = plan.question_order.slice(i * plan.per_day, i * plan.per_day + plan.per_day)
    if (!ids.every(id => solvedSet.has(id))) {
      activeDayIndex = i
      break
    }
  }

  const dayIds = plan.question_order.slice(
    activeDayIndex * plan.per_day,
    activeDayIndex * plan.per_day + plan.per_day,
  )
  const remaining = dayIds.filter((id: number) => !solvedSet.has(id)).length
  const goalsMet = remaining === 0 && dueReviewCount === 0
  const streakNumber = goalsMet ? activeDayIndex + 1 : activeDayIndex

  return { goalsMet, streakNumber }
}

export function computeDailyGoalsMetToday(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
): boolean {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return false
  return computePlanStreakCore(p, progress, dueReviewCount).goalsMet
}

/** Headline streak when a study plan exists: completed “police” days in order (not activity_log). */
export function computePlanStreakDisplayNumber(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
): number | null {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return null
  return computePlanStreakCore(p, progress, dueReviewCount).streakNumber
}
