/**
 * Daily block completion — independent of Learn `progress.solved`.
 *
 * Rules:
 * - Today UI always shows the calendar day’s scheduled questions.
 * - Unfinished *past* days push into Today as catch-up until daily reps are done.
 * - Daily done = ≥ repsPerQ on today (or, for catch-up clearance, on a day ≥ scheduled).
 * - Learn `solved` never clears Daily / catch-up for recent days.
 */

import { diffDaysSincePlanStart, planDayScheduledISO, todayISOChicago, type StudyPlanForStreak } from './studyPlanDay'

export const DAILY_REPS_PREFIX = 'lm_daily_reps_'
export const DAILY_REPS_CHANGED = 'lm-daily-reps-changed'

/** Past plan days older than this only need Learn solved for *plan advancement* of deep history. */
export const RECENT_PLAN_DAY_WINDOW = 7

export function notifyDailyRepsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DAILY_REPS_CHANGED))
}

/** Supabase DATE / timestamps → YYYY-MM-DD for reliable === today checks. */
export function normalizeRepDate(d: unknown): string | null {
  if (d == null || d === '') return null
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

export type DailyProgressSlice = {
  last_daily_done?: string | null
  daily_rep_count?: number
  daily_rep_date?: string | null
  solved?: boolean
}

/** Today's rep count for one question — DB progress row is source of truth. */
export function getDailyRepCount(
  id: number,
  progress: Record<string, DailyProgressSlice | undefined>,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
): number {
  const row = progress[String(id)]
  let dbCount = 0
  const repCount = row?.daily_rep_count ?? 0
  if (normalizeRepDate(row?.daily_rep_date) === today && repCount > 0) {
    dbCount = repCount
  }
  const fromMap = dailyReps?.[String(id)]
  if (fromMap !== undefined && fromMap > dbCount) return fromMap
  const local = readDailyRepsLocal(today)[String(id)] ?? 0
  return Math.max(dbCount, local)
}

/** Map of question id → rep count for today, derived from progress rows. */
export function dailyRepsFromProgress(
  progress: Record<string, DailyProgressSlice | undefined>,
  today = todayISOChicago(),
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, row] of Object.entries(progress)) {
    const repCount = row?.daily_rep_count ?? 0
    if (normalizeRepDate(row?.daily_rep_date) === today && repCount > 0) {
      out[id] = repCount
    }
  }
  for (const [id, count] of Object.entries(readDailyRepsLocal(today))) {
    if (count > (out[id] ?? 0)) out[id] = count
  }
  return out
}

/** Legacy localStorage read — backup when DB sync lags (same device / offline). */
export function readDailyRepsLocal(today = todayISOChicago()): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(`${DAILY_REPS_PREFIX}${today}`) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/**
 * True if this device recorded ≥repsPerQ daily reps on any localStorage day
 * on or after the missed schedule date.
 */
function catchUpClearedInLocalStorage(id: number, missedDayScheduledISO: string, repsPerQ: number): boolean {
  if (typeof window === 'undefined') return false
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(DAILY_REPS_PREFIX)) continue
    const date = key.slice(DAILY_REPS_PREFIX.length)
    if (date < missedDayScheduledISO) continue
    try {
      const map = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>
      if ((map[String(id)] ?? 0) >= repsPerQ) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

export function writeDailyRepsLocal(questionId: number, count: number, today = todayISOChicago()) {
  if (typeof window === 'undefined') return
  const map = readDailyRepsLocal(today)
  map[String(questionId)] = count
  localStorage.setItem(`${DAILY_REPS_PREFIX}${today}`, JSON.stringify(map))
}

/**
 * Done for *today's* Daily block — requires real reps (≥ repsPerQ).
 * Learn solved / bare last_daily_done without reps do not count.
 */
export function isQuestionDoneForDailyToday(
  id: number,
  progress: Record<string, DailyProgressSlice | undefined>,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
  repsPerQ = 2,
): boolean {
  return getDailyRepCount(id, progress, today, dailyReps) >= repsPerQ
}

/**
 * Did this question complete enough daily reps on/after the missed schedule date?
 * Used for catch-up clearance and Past Days "Daily" badges.
 */
export function hasCompletedDailyRepsOnOrAfter(
  id: number,
  onOrAfterISO: string,
  progress: Record<string, DailyProgressSlice | undefined>,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
  repsPerQ = 2,
): boolean {
  if (isQuestionDoneForDailyToday(id, progress, today, dailyReps, repsPerQ)) return true

  const row = progress[String(id)]
  const repDate = normalizeRepDate(row?.daily_rep_date)
  const repCount = row?.daily_rep_count ?? 0
  if (repDate && repDate >= onOrAfterISO && repCount >= repsPerQ) return true

  // last_daily_done alone is not enough — need matching full reps on that date
  const lastDone = normalizeRepDate(row?.last_daily_done)
  if (lastDone && lastDone >= onOrAfterISO && repDate === lastDone && repCount >= repsPerQ) {
    return true
  }

  return catchUpClearedInLocalStorage(id, onOrAfterISO, repsPerQ)
}

/**
 * Missed-day catch-up cleared only when Daily reps were finished (not Learn).
 */
export function isCatchUpDailyCleared(
  id: number,
  missedDayScheduledISO: string,
  progress: Record<string, DailyProgressSlice | undefined>,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
  repsPerQ = 2,
): boolean {
  return hasCompletedDailyRepsOnOrAfter(
    id,
    missedDayScheduledISO,
    progress,
    today,
    dailyReps,
    repsPerQ,
  )
}

/** Whether a strict-plan day slot is cleared (past days vs today). */
export function isPlanDayComplete(
  dayIndex: number,
  questionIds: number[],
  progress: Record<string, DailyProgressSlice | undefined>,
  calendarDiffDays: number,
  today = todayISOChicago(),
  dailyReps?: Record<string, number>,
  repsPerQ = 2,
  planStartDate?: string,
): boolean {
  if (questionIds.length === 0) return true
  if (dayIndex < calendarDiffDays) {
    const deepPastCutoff = calendarDiffDays - RECENT_PLAN_DAY_WINDOW
    // Deep history: Learn solved is enough so ancient days don't flood catch-up forever.
    if (dayIndex < deepPastCutoff) {
      return questionIds.every(id => !!progress[String(id)]?.solved)
    }
    if (!planStartDate) {
      // Without a start date we cannot know the scheduled ISO — require daily reps today.
      return questionIds.every(id =>
        isQuestionDoneForDailyToday(id, progress, today, dailyReps, repsPerQ),
      )
    }
    const scheduled = planDayScheduledISO(planStartDate, dayIndex)
    return questionIds.every(id =>
      isCatchUpDailyCleared(id, scheduled, progress, today, dailyReps, repsPerQ),
    )
  }
  return questionIds.every(id =>
    isQuestionDoneForDailyToday(id, progress, today, dailyReps, repsPerQ),
  )
}

/**
 * Calendar day index for “Today” UI (0-based). Always the schedule date’s day,
 * not the first incomplete catch-up day.
 */
export function getCalendarPlanDayIndex(plan: StudyPlanForStreak): number {
  const diffDays = diffDaysSincePlanStart(plan.start_date)
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  if (diffDays < 0 || totalDays <= 0) return 0
  return Math.min(diffDays, totalDays - 1)
}

/** Question ids scheduled for the calendar “today” plan day. */
export function getCalendarDayQuestionIds(plan: StudyPlanForStreak): number[] {
  const dayIndex = getCalendarPlanDayIndex(plan)
  return plan.question_order.slice(
    dayIndex * plan.per_day,
    dayIndex * plan.per_day + plan.per_day,
  )
}

/**
 * Unfinished recent past-day questions that should push into Today.
 * Deep-past days (Learn-only rule) are not pushed.
 */
export function getPushedCatchUpQuestionIds(
  plan: StudyPlanForStreak,
  progress: Record<string, DailyProgressSlice | undefined>,
  opts?: { dailyReps?: Record<string, number>; repsPerQ?: number; today?: string },
): number[] {
  const today = opts?.today ?? todayISOChicago()
  const repsPerQ = opts?.repsPerQ ?? 2
  const diffDays = diffDaysSincePlanStart(plan.start_date)
  if (diffDays <= 0) return []

  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)
  const deepPastCutoff = Math.max(0, diffDays - RECENT_PLAN_DAY_WINDOW)
  const result: number[] = []

  for (let i = deepPastCutoff; i < Math.min(diffDays, totalDays); i++) {
    const slice = plan.question_order.slice(i * plan.per_day, i * plan.per_day + plan.per_day)
    const scheduled = planDayScheduledISO(plan.start_date, i)
    for (const id of slice) {
      if (!isCatchUpDailyCleared(id, scheduled, progress, today, opts?.dailyReps, repsPerQ)) {
        result.push(id)
      }
    }
  }
  return result
}

/** First incomplete day (catch-up aware) — used by streaks / emails. */
export function findActiveDayIndex(
  plan: StudyPlanForStreak,
  progress: Record<string, DailyProgressSlice | undefined>,
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
    if (!isPlanDayComplete(i, slice, progress, diffDays, today, opts?.dailyReps, repsPerQ, plan.start_date)) {
      activeDayIndex = i
      break
    }
  }

  return { activeDayIndex, diffDays, totalDays }
}

export function getActiveDayQuestionIds(
  plan: StudyPlanForStreak,
  progress: Record<string, DailyProgressSlice | undefined>,
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

/**
 * Daily block complete for streak/emails:
 * calendar today's questions done AND all recent catch-ups cleared.
 */
export function isActiveDailyBlockComplete(
  plan: StudyPlanForStreak,
  progress: Record<string, DailyProgressSlice | undefined>,
  opts?: {
    mode?: string
    dailyDoneTodayCount?: number
    /** @deprecated use dailyDoneTodayCount */
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
    const count = opts?.dailyDoneTodayCount ?? opts?.solvedTodayCount ?? 0
    return count >= plan.per_day
  }

  const calendarIds = getCalendarDayQuestionIds(plan)
  const calendarDone =
    calendarIds.length > 0 &&
    calendarIds.every(id => isQuestionDoneForDailyToday(id, progress, today, opts?.dailyReps, repsPerQ))
  if (!calendarDone) return false

  const pushed = getPushedCatchUpQuestionIds(plan, progress, {
    dailyReps: opts?.dailyReps,
    repsPerQ,
    today,
  })
  return pushed.every(id => isQuestionDoneForDailyToday(id, progress, today, opts?.dailyReps, repsPerQ))
}
