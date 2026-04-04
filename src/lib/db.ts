import { supabase } from './supabase'

const USER_ID = 'emmanuel'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  let reviewCount = existing?.review_count ?? 0
  let nextReview = existing?.next_review ?? null
  let lastReviewed = existing?.last_reviewed ?? null

  if (data.solved === true && !existing?.solved) {
    reviewCount = 0
    const d = new Date()
    d.setDate(d.getDate() + srInterval(0))
    nextReview = localDateISO(d)
    lastReviewed = todayISO()
    await logSolvedToday()
  }

  if (data.solved === false && existing?.solved) {
    reviewCount = 0
    nextReview = null
    lastReviewed = null
  }

  const { error: upsertErr } = await supabase.from('progress').upsert({
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
  if (upsertErr) console.error('[db] updateProgress:', upsertErr.message)

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
  const { data, error } = await supabase
    .from('study_plan')
    .select('*')
    .eq('user_id', USER_ID)
    .single()
  if (error && error.code !== 'PGRST116') console.error('[db] getStudyPlan:', error.message)
  return data
}

export async function saveStudyPlan(plan: {
  start_date: string
  per_day: number
  question_order: number[]
  lock_code: string
}) {
  const { error } = await supabase.from('study_plan').upsert({
    user_id: USER_ID,
    ...plan,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) console.error('[db] saveStudyPlan:', error.message)
  return !error
}

export async function clearStudyPlan() {
  const { error } = await supabase.from('study_plan').delete().eq('user_id', USER_ID)
  if (error) console.error('[db] clearStudyPlan:', error.message)
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
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .eq('language', language)
    .single()
  if (error && error.code !== 'PGRST116') console.error('[db] getPracticeSession:', error.message)
  return data
}

export async function savePracticeSession(questionId: number, language: string, code: string, result?: any) {
  const { error } = await supabase.from('practice_sessions').upsert({
    user_id: USER_ID,
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

export async function getMockSessions(limit = 20): Promise<MockSessionRecord[]> {
  const { data, error } = await supabase
    .from('mock_sessions')
    .select('*')
    .eq('user_id', USER_ID)
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

export async function saveMockSession(session: Omit<MockSessionRecord, 'id'>) {
  const { error } = await supabase.from('mock_sessions').insert({
    user_id: USER_ID,
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

export async function clearInterviewDate() {
  await supabase.from('interview_date').delete().eq('user_id', USER_ID)
}

// ─── Spaced Repetition ───────────────────────────────────────────────────────
// Formula: alternates +5/+9 days starting at 7, hard-capped at 70.
// 0→7, 1→12, 2→21, 3→26, 4→35, 5→40, 6→49, 7→54, 8→63, 9+→70
// At 70 the cycle repeats every 70 days — every learned question
// comes back within 70 days no matter how well you know it.
function srInterval(n: number): number {
  return Math.min(70, Math.floor(n / 2) * 14 + (n % 2 === 0 ? 7 : 12))
}

export async function completeReview(questionId: number) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .single()

  const newCount = (existing?.review_count ?? 0) + 1
  const d = new Date()
  d.setDate(d.getDate() + srInterval(newCount))
  const nextReview = localDateISO(d)

  await supabase.from('progress').upsert({
    ...existing,
    user_id: USER_ID,
    question_id: questionId,
    review_count: newCount,
    next_review: nextReview,
    last_reviewed: todayISO(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })

  return { review_count: newCount, next_review: nextReview }
}

// Recalculate next_review from last_reviewed for any record where
// next_review doesn't match last_reviewed + correct interval.
// Runs silently — fixes drift caused by timezone bugs or manual solves.
export async function recalibrateSRDates() {
  const { data } = await supabase
    .from('progress')
    .select('question_id,review_count,next_review,last_reviewed')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('last_reviewed', 'is', null)

  if (!data?.length) return

  const updates: Array<{ question_id: number; next_review: string }> = []

  for (const row of data) {
    const interval = srInterval(row.review_count ?? 0)
    const base = new Date(row.last_reviewed + 'T12:00:00') // noon local avoids DST edge
    base.setDate(base.getDate() + interval)
    const expected = localDateISO(base)
    if (row.next_review !== expected) {
      updates.push({ question_id: row.question_id, next_review: expected })
    }
  }

  for (const u of updates) {
    await supabase.from('progress').update({ next_review: u.next_review })
      .eq('user_id', USER_ID)
      .eq('question_id', u.question_id)
  }
}

export async function getDueReviews(): Promise<Array<{ id: number; review_count: number; next_review: string }>> {
  await recalibrateSRDates()
  const today = todayISO()
  const { data } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .lte('next_review', today)

  return (data ?? []).map((r: any) => ({ id: r.question_id, review_count: r.review_count, next_review: r.next_review }))
}

// ─── Pattern FC Visited ───────────────────────────────────────────────────────
export async function getPatternFcVisited(): Promise<Set<number>> {
  const { data } = await supabase
    .from('pattern_fc_visited')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .single()
  return new Set(data?.question_ids ?? [])
}

export async function addPatternFcVisited(questionId: number) {
  const visited = await getPatternFcVisited()
  visited.add(questionId)
  await supabase.from('pattern_fc_visited').upsert({
    user_id: USER_ID,
    question_ids: [...visited],
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
