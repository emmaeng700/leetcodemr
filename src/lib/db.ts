import { supabase } from './supabase'

const USER_ID = 'emmanuel'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ─── Progress ─────────────────────────────────────────────────────────────────
export async function getProgress() {
  const { data } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', USER_ID)

  const result: Record<string, any> = {}
  for (const row of data || []) {
    result[String(row.question_id)] = {
      solved: row.solved,
      starred: row.starred,
      notes: row.notes,
      review_count: row.review_count,
      next_review: row.next_review,
      last_reviewed: row.last_reviewed,
      status: row.status,
    }
  }
  return result
}

export async function updateProgress(questionId: number, data: any) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .single()

  const SR_INTERVALS = [1, 3, 7, 14, 30, 60]
  let reviewCount = existing?.review_count ?? 0
  let nextReview = existing?.next_review ?? null
  let lastReviewed = existing?.last_reviewed ?? null

  if (data.solved === true && !existing?.solved) {
    reviewCount = 0
    const d = new Date()
    d.setDate(d.getDate() + SR_INTERVALS[0])
    nextReview = d.toISOString().split('T')[0]
    lastReviewed = todayISO()
    await logSolvedToday()
  }

  if (data.solved === false && existing?.solved) {
    reviewCount = 0
    nextReview = null
    lastReviewed = null
  }

  await supabase.from('progress').upsert({
    user_id: USER_ID,
    question_id: questionId,
    solved: data.solved ?? existing?.solved ?? false,
    starred: data.starred ?? existing?.starred ?? false,
    notes: data.notes ?? existing?.notes ?? '',
    status: data.status ?? existing?.status ?? null,
    review_count: reviewCount,
    next_review: nextReview,
    last_reviewed: lastReviewed,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })

  await logActivity()
}

// ─── Activity & Solved Logs ───────────────────────────────────────────────────
export async function logActivity() {
  const today = todayISO()
  const { data } = await supabase
    .from('activity_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()

  await supabase.from('activity_log').upsert({
    user_id: USER_ID,
    date: today,
    count: (data?.count ?? 0) + 1,
  }, { onConflict: 'user_id,date' })
}

export async function logSolvedToday() {
  const today = todayISO()
  const { data } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()

  await supabase.from('solved_log').upsert({
    user_id: USER_ID,
    date: today,
    count: (data?.count ?? 0) + 1,
  }, { onConflict: 'user_id,date' })
}

export async function getActivityLog(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('activity_log')
    .select('date,count')
    .eq('user_id', USER_ID)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[row.date] = row.count
  }
  return result
}

export async function getSolvedLog(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('solved_log')
    .select('date,count')
    .eq('user_id', USER_ID)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[row.date] = row.count
  }
  return result
}

export async function getTodaySolvedCount(): Promise<number> {
  const today = todayISO()
  const { data } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()
  return data?.count ?? 0
}

// ─── Visited Sets ─────────────────────────────────────────────────────────────
export async function getFcVisited(): Promise<Set<number>> {
  const { data } = await supabase
    .from('fc_visited')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addFcVisited(questionId: number) {
  const visited = await getFcVisited()
  visited.add(questionId)
  await supabase.from('fc_visited').upsert({
    user_id: USER_ID,
    question_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function getBehavioralVisited(): Promise<Set<number>> {
  const { data } = await supabase
    .from('behavioral_visited')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addBehavioralVisited(questionId: number) {
  const visited = await getBehavioralVisited()
  visited.add(questionId)
  await supabase.from('behavioral_visited').upsert({
    user_id: USER_ID,
    question_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function getGemsVisited(): Promise<Set<string>> {
  const { data } = await supabase
    .from('gems_visited')
    .select('card_ids')
    .eq('user_id', USER_ID)
    .single()
  return new Set(data?.card_ids ?? [])
}

export async function addGemsVisited(cardId: string) {
  const visited = await getGemsVisited()
  visited.add(cardId)
  await supabase.from('gems_visited').upsert({
    user_id: USER_ID,
    card_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── Study Plan ───────────────────────────────────────────────────────────────
export async function getStudyPlan() {
  const { data } = await supabase
    .from('study_plan')
    .select('*')
    .eq('user_id', USER_ID)
    .single()
  return data
}

export async function saveStudyPlan(plan: {
  start_date: string
  per_day: number
  question_order: number[]
  lock_code: string
}) {
  await supabase.from('study_plan').upsert({
    user_id: USER_ID,
    ...plan,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function clearStudyPlan() {
  await supabase.from('study_plan').delete().eq('user_id', USER_ID)
}

// ─── Daily Target ─────────────────────────────────────────────────────────────
export async function getDailyTarget(): Promise<{ target: number; lock_code: string }> {
  const { data } = await supabase
    .from('daily_target')
    .select('target,lock_code')
    .eq('user_id', USER_ID)
    .single()
  return data ?? { target: 0, lock_code: '' }
}

export async function setDailyTarget(target: number, lock_code: string) {
  await supabase.from('daily_target').upsert({
    user_id: USER_ID,
    target,
    lock_code,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── Practice Sessions ────────────────────────────────────────────────────────
export async function getPracticeSession(questionId: number, language: string) {
  const { data } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .eq('language', language)
    .single()
  return data
}

export async function savePracticeSession(questionId: number, language: string, code: string, result?: any) {
  await supabase.from('practice_sessions').upsert({
    user_id: USER_ID,
    question_id: questionId,
    language,
    code,
    last_result: result ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id,language' })
}

export async function getAllPracticeSessions() {
  const { data } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', USER_ID)
  return data ?? []
}

// ─── Time Tracking ────────────────────────────────────────────────────────────
export async function addTimeSpent(questionId: number, seconds: number) {
  const { data } = await supabase
    .from('time_tracking')
    .select('seconds')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .single()

  await supabase.from('time_tracking').upsert({
    user_id: USER_ID,
    question_id: questionId,
    seconds: (data?.seconds ?? 0) + Math.round(seconds),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })
}

export async function getTimeTracking(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('time_tracking')
    .select('question_id,seconds')
    .eq('user_id', USER_ID)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[String(row.question_id)] = row.seconds
  }
  return result
}

// ─── Interview Date ───────────────────────────────────────────────────────────
export async function getInterviewDate() {
  const { data } = await supabase
    .from('interview_date')
    .select('*')
    .eq('user_id', USER_ID)
    .single()
  return data
}

export async function setInterviewDate(target_date: string, company: string) {
  await supabase.from('interview_date').upsert({
    user_id: USER_ID,
    target_date,
    company,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── FC Daily Log ─────────────────────────────────────────────────────────────
export async function logFlashcardViewToday(questionId: number) {
  const today = todayISO()
  const { data } = await supabase
    .from('fc_daily_log')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()

  const ids = new Set<number>(data?.question_ids ?? [])
  if (!ids.has(questionId)) {
    ids.add(questionId)
    await supabase.from('fc_daily_log').upsert({
      user_id: USER_ID,
      date: today,
      question_ids: [...ids],
    }, { onConflict: 'user_id,date' })
  }
}

export async function getTodayFcCount(): Promise<number> {
  const today = todayISO()
  const { data } = await supabase
    .from('fc_daily_log')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()
  return (data?.question_ids ?? []).length
}
