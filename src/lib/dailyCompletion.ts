/**
 * What counts as "done" for today's daily block (Daily UI, streak, emails).
 * A question done earlier in Learn still appears on today's list until finished
 * again today (reps or marked solved with last_reviewed = today).
 */

import { diffDaysSincePlanStart, normalizeStudyPlanRow, todayISOChicago, type StudyPlanForStreak } from './studyPlanDay'

export const DAILY_REPS_PREFIX = 'lm_daily_reps_'

export function readDailyRepsLocal(today = todayISOChicago()): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(`${DAILY_REPS_PREFIX}${today}`) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function bumpDailyRepLocal(questionId: number, today = todayISOChicago()): number {
  if (typeof window === 'undefined') return 0
  const reps = readDailyRepsLocal(today)
  const next = (reps[String(questionId)] ?? 0) + 1
  reps[String(questionId)] = next
  localStorage.setItem(`${DAILY_REPS_PREFIX}${today}`, JSON.stringify(reps))
  return next
}

export function isQuestionDoneForDailyToday(
  id: number,
  progress: Record<string, { solved?: boolean; last_reviewed?: string | null } | undefined>,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
  repsPerQ = 2,
): boolean {
  if ((dailyReps?.[String(id)] ?? 0) >= repsPerQ) return true
  const p = progress[String(id)]
  return !!(p?.solved && p.last_reviewed === today)
}

/** First plan day (up to calendar today) that still has questions not done for today. */
export function findActiveDayIndex(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean; last_reviewed?: string | null } | undefined>,
  opts?: { dailyReps?: Record<string, number>; repsPerQ?: number; today?: string },
): { activeDayIndex: number; diffDays: number; totalDays: number } | null {
  const today = opts?.today ?? todayISOChicago()
  const repsPerQ = opts?.repsPerQ ?? 2
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
    if (slice.some(id => !isQuestionDoneForDailyToday(id, progress, today, opts?.dailyReps, repsPerQ))) {
      activeDayIndex = i
      break
    }
  }

  return { activeDayIndex, diffDays, totalDays }
}

export function getActiveDayQuestionIds(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean; last_reviewed?: string | null } | undefined>,
  opts?: { dailyReps?: Record<string, number>; repsPerQ?: number; today?: string },
): number[] {
  const meta = findActiveDayIndex(plan, progress, opts)
  if (!meta) return []
  const { activeDayIndex } = meta
  return plan.question_order.slice(
    activeDayIndex * plan.per_day,
    activeDayIndex * plan.per_day + plan.per_day,
  )
}

export function isActiveDailyBlockComplete(
  plan: StudyPlanForStreak,
  progress: Record<string, { solved?: boolean; last_reviewed?: string | null } | undefined>,
  opts?: {
    mode?: string
    solvedTodayCount?: number
    dailyReps?: Record<string, number>
    repsPerQ?: number
    today?: string
  },
): boolean {
  const mode = opts?.mode ?? plan.mode ?? 'strict'
  const today = opts?.today ?? todayISOChicago()
  const repsPerQ = opts?.repsPerQ ?? 2

  if (mode === 'random') {
    return (opts?.solvedTodayCount ?? 0) >= plan.per_day
  }

  const ids = getActiveDayQuestionIds(plan, progress, { dailyReps: opts?.dailyReps, repsPerQ, today })
  return ids.length > 0 && ids.every(id => isQuestionDoneForDailyToday(id, progress, today, opts?.dailyReps, repsPerQ))
}
