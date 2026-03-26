import { createBrowserClient } from '@supabase/ssr'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const supabase = getSupabaseClient()

// ─── Progress ─────────────────────────────────────────────────────────────────
export async function getProgress(userId: string) {
  const { data } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)

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

export async function updateProgress(userId: string, questionId: number, data: any) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .single()

  const SR_INTERVALS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 18, 24, 30, 45, 60]
  let reviewCount = existing?.review_count ?? 0
  let nextReview = existing?.next_review ?? null
  let lastReviewed = existing?.last_reviewed ?? null

  if (data.solved === true && !existing?.solved) {
    reviewCount = 0
    const d = new Date()
    d.setDate(d.getDate() + SR_INTERVALS[0])
    nextReview = localDateISO(d)
    lastReviewed = todayISO()
    await logSolvedToday(userId)
  }

  if (data.solved === false && existing?.solved) {
    reviewCount = 0
    nextReview = null
    lastReviewed = null
  }

  const { error: upsertErr } = await supabase.from('progress').upsert({
    user_id: userId,
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
  if (upsertErr) console.error('[db] updateProgress:', upsertErr.message)

  await logActivity(userId)
}

// ─── Activity & Solved Logs ───────────────────────────────────────────────────
export async function logActivity(userId: string) {
  const today = todayISO()
  const { data } = await supabase
    .from('activity_log')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  await supabase.from('activity_log').upsert({
    user_id: userId,
    date: today,
    count: (data?.count ?? 0) + 1,
  }, { onConflict: 'user_id,date' })
}

export async function logSolvedToday(userId: string) {
  const today = todayISO()
  const { data } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  await supabase.from('solved_log').upsert({
    user_id: userId,
    date: today,
    count: (data?.count ?? 0) + 1,
  }, { onConflict: 'user_id,date' })
}

export async function getActivityLog(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('activity_log')
    .select('date,count')
    .eq('user_id', userId)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[row.date] = row.count
  }
  return result
}

export async function getSolvedLog(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('solved_log')
    .select('date,count')
    .eq('user_id', userId)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[row.date] = row.count
  }
  return result
}

export async function getTodaySolvedCount(userId: string): Promise<number> {
  const today = todayISO()
  const { data } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  return data?.count ?? 0
}

// ─── Visited Sets ─────────────────────────────────────────────────────────────
export async function getFcVisited(userId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from('fc_visited')
    .select('question_ids')
    .eq('user_id', userId)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addFcVisited(userId: string, questionId: number) {
  const visited = await getFcVisited(userId)
  visited.add(questionId)
  await supabase.from('fc_visited').upsert({
    user_id: userId,
    question_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function getBehavioralVisited(userId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from('behavioral_visited')
    .select('question_ids')
    .eq('user_id', userId)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addBehavioralVisited(userId: string, questionId: number) {
  const visited = await getBehavioralVisited(userId)
  visited.add(questionId)
  await supabase.from('behavioral_visited').upsert({
    user_id: userId,
    question_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function getGemsVisited(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('gems_visited')
    .select('card_ids')
    .eq('user_id', userId)
    .single()
  return new Set(data?.card_ids ?? [])
}

export async function addGemsVisited(userId: string, cardId: string) {
  const visited = await getGemsVisited(userId)
  visited.add(cardId)
  await supabase.from('gems_visited').upsert({
    user_id: userId,
    card_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── Study Plan ───────────────────────────────────────────────────────────────
export async function getStudyPlan(userId: string) {
  const { data, error } = await supabase
    .from('study_plan')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') console.error('[db] getStudyPlan:', error.message)
  return data
}

export async function saveStudyPlan(userId: string, plan: {
  start_date: string
  per_day: number
  question_order: number[]
  lock_code: string
}) {
  const { error } = await supabase.from('study_plan').upsert({
    user_id: userId,
    ...plan,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) console.error('[db] saveStudyPlan:', error.message)
  return !error
}

export async function clearStudyPlan(userId: string) {
  const { error } = await supabase.from('study_plan').delete().eq('user_id', userId)
  if (error) console.error('[db] clearStudyPlan:', error.message)
}

// ─── Daily Target ─────────────────────────────────────────────────────────────
export async function getDailyTarget(userId: string): Promise<{ target: number; lock_code: string }> {
  const { data } = await supabase
    .from('daily_target')
    .select('target,lock_code')
    .eq('user_id', userId)
    .single()
  return data ?? { target: 0, lock_code: '' }
}

export async function setDailyTarget(userId: string, target: number, lock_code: string) {
  await supabase.from('daily_target').upsert({
    user_id: userId,
    target,
    lock_code,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── Practice Sessions ────────────────────────────────────────────────────────
export async function getPracticeSession(userId: string, questionId: number, language: string) {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .eq('language', language)
    .single()
  if (error && error.code !== 'PGRST116') console.error('[db] getPracticeSession:', error.message)
  return data
}

export async function savePracticeSession(userId: string, questionId: number, language: string, code: string, result?: any) {
  const { error } = await supabase.from('practice_sessions').upsert({
    user_id: userId,
    question_id: questionId,
    language,
    code,
    last_result: result ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id,language' })
  if (error) console.error('[db] savePracticeSession:', error.message)
}

// ─── Mock Sessions ────────────────────────────────────────────────────────────
export interface MockSessionRecord {
  id?: number
  date: string
  question_id?: number | null
  question_title?: string | null
  difficulty?: string | null
  outcome: string
  elapsed_seconds: number
  duration_seconds?: number
  created_at?: string
}

export async function getMockSessions(userId: string, limit = 20): Promise<MockSessionRecord[]> {
  const { data, error } = await supabase
    .from('mock_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[db] getMockSessions:', error.message)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date ?? r.created_at?.split('T')[0] ?? '',
    question_id: r.question_id,
    question_title: r.question_title,
    difficulty: r.difficulty,
    outcome: r.outcome,
    elapsed_seconds: r.elapsed_seconds,
    duration_seconds: r.duration_seconds,
  }))
}

export async function saveMockSession(userId: string, session: Omit<MockSessionRecord, 'id'>) {
  const { error } = await supabase.from('mock_sessions').insert({
    user_id: userId,
    date: session.date,
    question_id: session.question_id ?? null,
    question_title: session.question_title ?? null,
    difficulty: session.difficulty ?? null,
    outcome: session.outcome,
    elapsed_seconds: session.elapsed_seconds,
    duration_seconds: session.duration_seconds ?? null,
    created_at: session.created_at ?? new Date().toISOString(),
  })
  if (error) console.error('[db] saveMockSession:', error.message)
  return !error
}

export async function getAllPracticeSessions(userId: string) {
  const { data } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
  return data ?? []
}

// ─── Time Tracking ────────────────────────────────────────────────────────────
export async function addTimeSpent(userId: string, questionId: number, seconds: number) {
  const { data } = await supabase
    .from('time_tracking')
    .select('seconds')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .single()

  await supabase.from('time_tracking').upsert({
    user_id: userId,
    question_id: questionId,
    seconds: (data?.seconds ?? 0) + Math.round(seconds),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })
}

export async function getTimeTracking(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('time_tracking')
    .select('question_id,seconds')
    .eq('user_id', userId)

  const result: Record<string, number> = {}
  for (const row of data || []) {
    result[String(row.question_id)] = row.seconds
  }
  return result
}

// ─── Interview Date ───────────────────────────────────────────────────────────
export async function getInterviewDate(userId: string) {
  const { data } = await supabase
    .from('interview_date')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function setInterviewDate(userId: string, target_date: string, company: string) {
  await supabase.from('interview_date').upsert({
    user_id: userId,
    target_date,
    company,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── Spaced Repetition ───────────────────────────────────────────────────────
const SR_INTERVALS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 18, 24, 30, 45, 60]

export async function completeReview(userId: string, questionId: number) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .single()

  const newCount = (existing?.review_count ?? 0) + 1
  const d = new Date()
  d.setDate(d.getDate() + SR_INTERVALS[Math.min(newCount, SR_INTERVALS.length - 1)])
  const nextReview = localDateISO(d)

  await supabase.from('progress').upsert({
    ...existing,
    user_id: userId,
    question_id: questionId,
    review_count: newCount,
    next_review: nextReview,
    last_reviewed: todayISO(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })

  return { review_count: newCount, next_review: nextReview }
}

export async function recalibrateSRDates(userId: string) {
  const { data } = await supabase
    .from('progress')
    .select('question_id,review_count,next_review,last_reviewed')
    .eq('user_id', userId)
    .eq('solved', true)
    .not('last_reviewed', 'is', null)

  if (!data?.length) return

  const updates: Array<{ question_id: number; next_review: string }> = []

  for (const row of data) {
    const interval = SR_INTERVALS[Math.min(row.review_count ?? 0, SR_INTERVALS.length - 1)]
    const base = new Date(row.last_reviewed + 'T12:00:00') // noon local avoids DST edge
    base.setDate(base.getDate() + interval)
    const expected = localDateISO(base)
    if (row.next_review !== expected) {
      updates.push({ question_id: row.question_id, next_review: expected })
    }
  }

  for (const u of updates) {
    await supabase.from('progress').update({ next_review: u.next_review })
      .eq('user_id', userId)
      .eq('question_id', u.question_id)
  }
}

export async function getDueReviews(userId: string): Promise<Array<{ id: number; review_count: number; next_review: string }>> {
  await recalibrateSRDates(userId)
  const today = todayISO()
  const { data } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', userId)
    .eq('solved', true)
    .lte('next_review', today)

  return (data ?? []).map((r: any) => ({ id: r.question_id, review_count: r.review_count, next_review: r.next_review }))
}

// ─── Pattern FC Visited ───────────────────────────────────────────────────────
export async function getPatternFcVisited(userId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from('pattern_fc_visited')
    .select('question_ids')
    .eq('user_id', userId)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addPatternFcVisited(userId: string, questionId: number) {
  const visited = await getPatternFcVisited(userId)
  visited.add(questionId)
  await supabase.from('pattern_fc_visited').upsert({
    user_id: userId,
    question_ids: [...visited],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ─── FC Daily Log ─────────────────────────────────────────────────────────────
export async function logFlashcardViewToday(userId: string, questionId: number) {
  const today = todayISO()
  const { data } = await supabase
    .from('fc_daily_log')
    .select('question_ids')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const ids = new Set<number>(data?.question_ids ?? [])
  if (!ids.has(questionId)) {
    ids.add(questionId)
    await supabase.from('fc_daily_log').upsert({
      user_id: userId,
      date: today,
      question_ids: [...ids],
    }, { onConflict: 'user_id,date' })
  }
}

export async function getTodayFcCount(userId: string): Promise<number> {
  const today = todayISO()
  const { data } = await supabase
    .from('fc_daily_log')
    .select('question_ids')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  return (data?.question_ids ?? []).length
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export async function getUserProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function saveBehavioralAnswers(userId: string, answers: Array<{
  question_index: number
  story_index: number
  situation: string
  task_text: string
  action: string
  result: string
}>) {
  // Delete old answers first
  await supabase
    .from('behavioral_answers')
    .delete()
    .eq('user_id', userId)

  if (answers.length > 0) {
    const { error } = await supabase
      .from('behavioral_answers')
      .insert(answers.map(a => ({ ...a, user_id: userId })))
    if (error) console.error('[db] saveBehavioralAnswers:', error.message)
  }
}
