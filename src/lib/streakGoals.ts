/** Same rules as `syncStreakActivityFromGoals` / notify-daily: active daily block fully solved and zero SR due. */

export interface StudyPlanForStreak {
  start_date: string
  per_day: number
  question_order: number[]
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeDailyGoalsMetToday(
  plan: StudyPlanForStreak | null,
  progress: Record<string, { solved?: boolean } | undefined>,
  dueReviewCount: number,
): boolean {
  const today = todayISO()

  const solvedSet = new Set<number>()
  for (const [id, row] of Object.entries(progress)) {
    if (row?.solved) solvedSet.add(Number(id))
  }

  if (!plan?.question_order?.length) return false

  const start = new Date(plan.start_date + 'T00:00:00')
  const now = new Date(today + 'T00:00:00')
  start.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)

  if (diffDays < 0 || diffDays >= totalDays) return false

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

  return remaining === 0 && dueReviewCount === 0
}
