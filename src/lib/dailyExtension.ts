import { isPlanDayComplete, type DailyProgressSlice } from '@/lib/dailyCompletion'
import type { SetQuestion } from '@/lib/questionSets'
import type { SetQProgress } from '@/lib/setProgress'

export type ExtensionPhase = {
  set: 2 | 3
  questions: SetQuestion[]
  order: number[]
  progress: Record<string, SetQProgress>
  totalDays: number
  /** Global schedule day index (0-based) where this phase begins. */
  startDayIndex: number
}

export function isSet1PlanAllDaysComplete(
  questionOrder: number[],
  perDay: number,
  progress: Record<string, DailyProgressSlice | undefined>,
  calendarDayIndex: number,
  today: string,
  dailyReps: Record<string, number>,
  repsPerQ: number,
): boolean {
  const totalDays = Math.ceil(questionOrder.length / perDay)
  if (totalDays <= 0) return false
  for (let i = 0; i < totalDays; i++) {
    const questionIds = questionOrder.slice(i * perDay, i * perDay + perDay)
    if (!isPlanDayComplete(i, questionIds, progress, calendarDayIndex, today, dailyReps, repsPerQ)) {
      return false
    }
  }
  return true
}

export function buildExtensionPhases(
  set2Questions: SetQuestion[],
  set3Questions: SetQuestion[],
  set2Progress: Record<string, SetQProgress>,
  set3Progress: Record<string, SetQProgress>,
  perDay: number,
  set1TotalDays: number,
): ExtensionPhase[] {
  const phases: ExtensionPhase[] = []
  let startIdx = set1TotalDays
  if (set2Questions.length > 0) {
    const totalDays = Math.ceil(set2Questions.length / perDay)
    phases.push({
      set: 2,
      questions: set2Questions,
      order: set2Questions.map(q => q.id),
      progress: set2Progress,
      totalDays,
      startDayIndex: startIdx,
    })
    startIdx += totalDays
  }
  if (set3Questions.length > 0) {
    phases.push({
      set: 3,
      questions: set3Questions,
      order: set3Questions.map(q => q.id),
      progress: set3Progress,
      totalDays: Math.ceil(set3Questions.length / perDay),
      startDayIndex: startIdx,
    })
  }
  return phases
}

export function getExtensionQuestionsForDay(
  order: number[],
  perDay: number,
  dayIndexWithinPhase: number,
): number[] {
  const start = dayIndexWithinPhase * perDay
  return order.slice(start, start + perDay)
}

export function isExtensionDayComplete(
  order: number[],
  perDay: number,
  dayIndexWithinPhase: number,
  progress: Record<string, SetQProgress>,
): boolean {
  const ids = getExtensionQuestionsForDay(order, perDay, dayIndexWithinPhase)
  if (ids.length === 0) return true
  return ids.every(id => !!progress[String(id)]?.solved)
}

/** First incomplete day within a phase (mirrors Set 1 catch-up behavior). */
export function findActiveExtensionDay(
  phase: ExtensionPhase,
  perDay: number,
): { dayIndex: number; questionIds: number[] } {
  const { order, progress, totalDays } = phase
  let activeDay = 0
  for (let i = 0; i < totalDays; i++) {
    if (!isExtensionDayComplete(order, perDay, i, progress)) {
      activeDay = i
      break
    }
    if (i === totalDays - 1) activeDay = i
  }
  return {
    dayIndex: activeDay,
    questionIds: getExtensionQuestionsForDay(order, perDay, activeDay),
  }
}

/** Set 2 while incomplete, then Set 3. */
export function getActiveExtensionPhase(
  phases: ExtensionPhase[],
  perDay: number,
): ExtensionPhase | null {
  for (const phase of phases) {
    for (let i = 0; i < phase.totalDays; i++) {
      if (!isExtensionDayComplete(phase.order, perDay, i, phase.progress)) {
        return phase
      }
    }
  }
  return null
}

export function getGrandTotalDays(set1TotalDays: number, phases: ExtensionPhase[]): number {
  return set1TotalDays + phases.reduce((sum, p) => sum + p.totalDays, 0)
}

export type ScheduleDay =
  | { kind: 'set1'; globalDayIndex: number; dayWithinSet1: number }
  | { kind: 'extension'; globalDayIndex: number; phase: ExtensionPhase; dayWithinPhase: number }

export function resolveScheduleDay(
  globalDayIndex: number,
  set1TotalDays: number,
  phases: ExtensionPhase[],
): ScheduleDay | null {
  if (globalDayIndex < 0) return null
  if (globalDayIndex < set1TotalDays) {
    return { kind: 'set1', globalDayIndex, dayWithinSet1: globalDayIndex }
  }
  let offset = globalDayIndex - set1TotalDays
  for (const phase of phases) {
    if (offset < phase.totalDays) {
      return { kind: 'extension', globalDayIndex, phase, dayWithinPhase: offset }
    }
    offset -= phase.totalDays
  }
  return null
}

export function questionIdsForScheduleDay(
  scheduleDay: ScheduleDay,
  questionOrder: number[],
  perDay: number,
): number[] {
  if (scheduleDay.kind === 'set1') {
    const start = scheduleDay.dayWithinSet1 * perDay
    return questionOrder.slice(start, start + perDay)
  }
  return getExtensionQuestionsForDay(
    scheduleDay.phase.order,
    perDay,
    scheduleDay.dayWithinPhase,
  )
}

/** One scheduled day in the merged Set 1 ? Set 2 ? Set 3 timeline. */
export type CombinedScheduleDay = {
  questionIds: number[]
  set: 1 | 2 | 3
}

/** Build per-day buckets for Daily / timeline UIs (Set 1 then extension phases). */
export function buildCombinedScheduleDays(
  planOrder: number[],
  perDay: number,
  extensionPhases: ExtensionPhase[],
): CombinedScheduleDay[] {
  const days: CombinedScheduleDay[] = []
  for (let i = 0; i < planOrder.length; i += perDay) {
    days.push({ questionIds: planOrder.slice(i, i + perDay), set: 1 })
  }
  for (const phase of extensionPhases) {
    for (let i = 0; i < phase.order.length; i += perDay) {
      days.push({ questionIds: phase.order.slice(i, i + perDay), set: phase.set })
    }
  }
  return days
}

export function isExtensionSetQuestionSolved(
  id: number,
  set: 2 | 3,
  set2Progress: Record<string, SetQProgress>,
  set3Progress: Record<string, SetQProgress>,
): boolean {
  const prog = set === 2 ? set2Progress : set3Progress
  return !!prog[String(id)]?.solved
}

export function learnHrefForSetQuestion(
  id: number,
  set: 2 | 3,
  set2Questions: SetQuestion[],
  set3Questions: SetQuestion[],
): string {
  const fullSet = set === 2 ? set2Questions : set3Questions
  return `/learn${set}/${Math.max(0, fullSet.findIndex(q => q.id === id))}`
}

export function reviewHrefForQuestion(
  id: number,
  set2Questions: SetQuestion[],
  set3Questions: SetQuestion[],
): string {
  const set2Idx = set2Questions.findIndex(q => q.id === id)
  if (set2Idx >= 0) return `/learn2/${set2Idx}`
  const set3Idx = set3Questions.findIndex(q => q.id === id)
  if (set3Idx >= 0) return `/learn3/${set3Idx}`
  return `/practice/${id}`
}
