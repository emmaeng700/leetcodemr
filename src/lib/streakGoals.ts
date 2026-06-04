/**
 * Day-complete rules (app, streak, emails):
 * - Daily block must be finished first (marked solved in progress, or random quota).
 * - If SR reviews are due today, clear them too before the day counts as complete.
 * - If no reviews are due, finishing daily alone is enough.
 */

import { diffDaysSincePlanStart, normalizeStudyPlanRow, type StudyPlanForStreak } from './studyPlanDay'

export type { StudyPlanForStreak }
export { normalizeStudyPlanRow } from './studyPlanDay'

export type DailyGoalsOpts = {
  mode?: string
  /** Random mode: new solves logged today (solved_log). */
  solvedTodayCount?: number
}

function buildSolvedSet(progress: Record<string, { solved?: boolean } | undefined>) {
  const solvedSet = new Set<number>()
  for (const [id, row] of Object.entries(progress)) {
    if (row?.solved) solvedSet.add(Number(id))
  }
  return solvedSet
}

/** Mirrors notify-daily / Daily page: first incomplete plan day up to today. */
export function findActiveDayIndex(
  plan: StudyPlanForStreak,
  solvedSet: Set<number>,
): { activeDayIndex: number; diffDays: number; totalDays: number } | null {
  const diffDays = diffDaysSincePlanStart(plan.start_date)
  if (diffDays < 0) return null

  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  if (totalDays <= 0) return null

  if (diffDays >= totalDays) {
    return { activeDayIndex: totalDays - 1, diffDays, totalDays }
  }

  let activeDayIndex = Math.min(diffDays, totalDays - 1)
  for (let i = 0; i <= Math.min(diffDays, totalDays - 1); i++) {
    const slice = plan.question_order.slice(i * plan.per_day, i * plan.per_day + plan.per_day)
    if (slice.some(id => !solvedSet.has(id))) {
      activeDayIndex = i
      break
    }
  }

  return { activeDayIndex, diffDays, totalDays }
}

/** Active daily block finished (strict: all today's plan Qs solved; random: per_day quota). */
export function isActiveDailyBlockComplete(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean } | undefined>,
  opts?: DailyGoalsOpts,
): boolean {
  const mode = opts?.mode ?? plan.mode ?? 'strict'

  if (mode === 'random') {
    return (opts?.solvedTodayCount ?? 0) >= plan.per_day
  }

  const solvedSet = buildSolvedSet(progress)
  const meta = findActiveDayIndex(plan, solvedSet)
  if (!meta) return false

  const todayIds = plan.question_order.slice(
    meta.activeDayIndex * plan.per_day,
    meta.activeDayIndex * plan.per_day + plan.per_day,
  )
  return todayIds.length > 0 && todayIds.every(id => solvedSet.has(id))
}

/** Full day complete: daily done, and no SR reviews left due today. */
export function isDayComplete(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  opts?: DailyGoalsOpts,
): boolean {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return dueReviewCount === 0
  return isActiveDailyBlockComplete(p, progress, opts) && dueReviewCount === 0
}

function computePlanStreakCore(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  opts?: DailyGoalsOpts,
): { goalsMet: boolean; streakNumber: number } {
  const diffDaysRaw = diffDaysSincePlanStart(plan.start_date)
  const diffDays = Number.isFinite(diffDaysRaw) ? diffDaysRaw : 0

  if (diffDays < 0) {
    return { goalsMet: false, streakNumber: 0 }
  }

  const goalsMet = isDayComplete(plan, progress, dueReviewCount, opts)
  const streakNumber = diffDays + (goalsMet ? 1 : 0)

  return { goalsMet, streakNumber }
}

export function computeDailyGoalsMetToday(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  opts?: DailyGoalsOpts,
): boolean {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return dueReviewCount === 0
  return computePlanStreakCore(p, progress, dueReviewCount, opts).goalsMet
}

/** Headline streak when a study plan exists: completed “police” days in order (not activity_log). */
export function computePlanStreakDisplayNumber(
  plan: unknown,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
  opts?: DailyGoalsOpts,
): number | null {
  const p = normalizeStudyPlanRow(plan)
  if (!p) return null
  return computePlanStreakCore(p, progress, dueReviewCount, opts).streakNumber
}
