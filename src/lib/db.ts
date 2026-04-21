import { supabase } from './supabase'
import { computeDailyGoalsMetToday } from './streakGoals'
import { todayISOChicago } from './studyPlanDay'
import { srInterval } from './utils'

const USER_ID = 'emmanuel'

function localDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localTodayISO() {
  return localDateISO(new Date())
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

/** Increment count when user gets Accepted on a Submit (tracked per app question id). */
export async function incrementAcSubmitCount(questionId: number) {
  const { data: existing } = await supabase
    .from('ac_submit_counts')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .maybeSingle()
  const next = (existing?.count ?? 0) + 1
  const { error } = await supabase.from('ac_submit_counts').upsert(
    {
      user_id: USER_ID,
      question_id: questionId,
      count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' },
  )
  if (error) console.error('[db] incrementAcSubmitCount:', error.message)
}

export async function getAcSubmitCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('ac_submit_counts')
    .select('question_id, count')
    .eq('user_id', USER_ID)
  if (error) {
    console.error('[db] getAcSubmitCounts:', error.message)
    return {}
  }
  const out: Record<string, number> = {}
  for (const row of data || []) {
    out[String((row as { question_id: number }).question_id)] = (row as { count: number }).count
  }
  return out
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
    const todayCT = todayISOChicago()
    nextReview = addDaysISO(todayCT, srInterval(0))
    lastReviewed = todayCT
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

  try {
    await syncStreakActivityFromGoals()
  } catch (e) {
    console.error('[db] syncStreakActivityFromGoals:', e)
  }
  return upsertErr?.message ?? null
}

export async function addMasteryRunEvent(questionId: number, count = 1) {
  const inserts = Array.from({ length: Math.max(1, count) }, () => ({
    user_id: USER_ID,
    question_id: questionId,
  }))
  const { error } = await supabase.from('mastery_run_events').insert(inserts)
  if (error) console.error('[db] addMasteryRunEvent:', error.message)
  return { ok: !error, error: error?.message ?? null }
}

export async function getMasteryRunsByQuestion(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('mastery_run_events')
    .select('question_id')
    .eq('user_id', USER_ID)

  if (error) {
    console.error('[db] getMasteryRunsByQuestion:', error.message)
    return {}
  }

  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = String((row as any).question_id)
    out[id] = (out[id] ?? 0) + 1
  }
  return out
}

// ─── Activity & Solved Logs ───────────────────────────────────────────────────
export async function logSolvedToday() {
  // IMPORTANT: solved_log is used for Random-mode daily quota + streak checks.
  // It must be keyed by the same day definition as the rest of the app (Chicago),
  // otherwise the UI can show "done" while streak stays unticked (or vice versa).
  const today = todayISOChicago()
  const localToday = localTodayISO()

  const { data: ctRow } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()

  // Back-compat: if a device previously logged using local day, carry that forward
  // into the Chicago-keyed row the first time we see it.
  let base = ctRow?.count ?? 0
  if (base === 0 && localToday !== today) {
    const { data: localRow } = await supabase
      .from('solved_log')
      .select('count')
      .eq('user_id', USER_ID)
      .eq('date', localToday)
      .maybeSingle()
    if (typeof localRow?.count === 'number' && localRow.count > 0) {
      base = localRow.count
    }
  }

  await supabase.from('solved_log').upsert({
    user_id: USER_ID,
    date: today,
    count: base + 1,
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
  const today = todayISOChicago()
  const { data: ctRow } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .maybeSingle()

  if (typeof ctRow?.count === 'number') return ctRow.count

  // Back-compat: if a device previously wrote solved_log using local date,
  // read it once and migrate it forward so streak/quota reflect correctly.
  const localToday = localTodayISO()
  if (localToday === today) return 0

  const { data: localRow } = await supabase
    .from('solved_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', localToday)
    .maybeSingle()

  const localCount = (localRow?.count ?? 0) as number
  if (localCount > 0) {
    await supabase.from('solved_log').upsert({
      user_id: USER_ID,
      date: today,
      count: localCount,
    }, { onConflict: 'user_id,date' })
  }

  return localCount
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
  mode?: string
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
    date: r.date || (r.created_at ? String(r.created_at).split('T')[0] : '') || '',
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

// ─── Reset ───────────────────────────────────────────────────────────────────

export async function resetAllProgress(): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('progress')
    .update({
      solved: false,
      review_count: 0,
      next_review: null,
      last_reviewed: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', USER_ID)

  if (error) return { error: error.message }
  return {}
}

// ─── Spaced Repetition ───────────────────────────────────────────────────────
// srInterval is imported from utils.ts — single source of truth.

export async function completeReview(questionId: number) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .single()

  const newCount = (existing?.review_count ?? 0) + 1
  const todayCT = todayISOChicago()
  const nextReview = addDaysISO(todayCT, srInterval(newCount))

  await supabase.from('progress').upsert({
    ...existing,
    user_id: USER_ID,
    question_id: questionId,
    review_count: newCount,
    next_review: nextReview,
    last_reviewed: todayCT,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })

  try {
    await syncStreakActivityFromGoals()
  } catch (e) {
    console.error('[db] syncStreakActivityFromGoals:', e)
  }

  return { review_count: newCount, next_review: nextReview }
}

export async function failReview(questionId: number) {
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('question_id', questionId)
    .single()

  const newCount = 0
  const todayCT = todayISOChicago()
  const nextReview = addDaysISO(todayCT, srInterval(newCount))

  await supabase.from('progress').upsert({
    ...existing,
    user_id: USER_ID,
    question_id: questionId,
    review_count: newCount,
    next_review: nextReview,
    last_reviewed: todayCT,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' })

  try {
    await syncStreakActivityFromGoals()
  } catch (e) {
    console.error('[db] syncStreakActivityFromGoals:', e)
  }

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
    // Only fix if next_review is EARLIER than the formula date (timezone drift made it
    // appear overdue too soon). Never pull a question back from a future date that
    // spreadOverdueReviews intentionally placed it on.
    if (row.next_review < expected) {
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
  const cap = getDailyReviewCapChicago()
  await spreadOverdueReviews({ maxPerDay: cap })
  const today = todayISOChicago()
  const { data } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .lte('next_review', today)
    .order('next_review', { ascending: true })

  // Hard cap: never return more than the daily limit even if spread didn't catch everything.
  return (data ?? []).slice(0, cap).map((r: any) => ({ id: r.question_id, review_count: r.review_count, next_review: r.next_review }))
}

/**
 * SR schedule window (due + upcoming) without applying daily caps/spreading.
 * Useful for "do extra reviews" views (Pileup).
 */
export async function getSrScheduleWindow(daysAhead = 30): Promise<Array<{ id: number; review_count: number; next_review: string }>> {
  const today = todayISOChicago()
  const horizon = addDaysISO(today, Math.max(0, Math.floor(daysAhead)))
  const { data } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', horizon)
    .order('next_review', { ascending: true })
  return (data ?? []).map((r: any) => ({ id: r.question_id, review_count: r.review_count, next_review: r.next_review }))
}

/** Count SR reviews completed today (last_reviewed = today Chicago). */
export async function getReviewsCompletedToday(): Promise<number> {
  const today = todayISOChicago()
  const { count } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('last_reviewed', today)
  return count ?? 0
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateISO(d)
}

function isWeekendChicago(dateISOChicago: string): boolean {
  const weekday = new Date(dateISOChicago + 'T12:00:00').toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  })
  return weekday === 'Sat' || weekday === 'Sun'
}

export function getDailyReviewCapChicago(dateISOChicago = todayISOChicago()): number {
  // Weekdays: 35 reviews/day. Weekends: 60 reviews/day.
  return isWeekendChicago(dateISOChicago) ? 60 : 35
}

/**
 * Keep SR sustainable by moving excess overdue reviews into future days.
 * This avoids "overdue" piles and enforces a soft daily cap.
 */
export async function spreadOverdueReviews(opts?: { maxPerDay?: number; horizonDays?: number }) {
  const maxPerDay = Math.max(1, Math.floor(opts?.maxPerDay ?? 5))
  const horizonDays = Math.max(7, Math.floor(opts?.horizonDays ?? 120))
  const today = todayISOChicago()

  const { data, error } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .order('next_review', { ascending: true })

  if (error) {
    console.error('[db] spreadOverdueReviews:', error.message)
    return
  }

  const rows = (data ?? []) as Array<{ question_id: number; next_review: string; review_count: number }>
  if (!rows.length) return

  // Mastery signal: how many accepted submissions you have for this question.
  // When we have to choose what stays "today" under a small cap, prioritize lower mastery first.
  const { data: acRows } = await supabase
    .from('ac_submit_counts')
    .select('question_id,count')
    .eq('user_id', USER_ID)
    .in('question_id', rows.map(r => r.question_id))

  const acCountById: Record<string, number> = {}
  for (const r of acRows ?? []) {
    const qid = String((r as any).question_id)
    acCountById[qid] = Number((r as any).count ?? 0) || 0
  }

  // Count scheduled reviews per day across the horizon, including today's already-scheduled items.
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const day = r.next_review
    if (!day) continue
    counts[day] = (counts[day] ?? 0) + 1
  }

  const overdue = rows
    .filter(r => r.next_review <= today)
    .sort((a, b) => {
      // Lower mastery first (fewer ACs), then lower SR review_count (less stable), then older due date.
      const acA = acCountById[String(a.question_id)] ?? 0
      const acB = acCountById[String(b.question_id)] ?? 0
      if (acA !== acB) return acA - acB
      const rcA = a.review_count ?? 0
      const rcB = b.review_count ?? 0
      if (rcA !== rcB) return rcA - rcB
      if (a.next_review !== b.next_review) return a.next_review.localeCompare(b.next_review)
      return a.question_id - b.question_id
    })
  if (overdue.length <= maxPerDay) return

  const updates: Array<{ question_id: number; next_review: string }> = []

  // Keep the first maxPerDay items on today; push the rest forward.
  const toPush = overdue.slice(maxPerDay)
  for (const r of toPush) {
    // Remove from its current day count (since we'll move it).
    counts[r.next_review] = Math.max(0, (counts[r.next_review] ?? 1) - 1)

    let placed = false
    for (let offset = 1; offset <= horizonDays; offset++) {
      const day = addDaysISO(today, offset)
      const dayCapacity = getDailyReviewCapChicago(day)
      if ((counts[day] ?? 0) < dayCapacity) {
        counts[day] = (counts[day] ?? 0) + 1
        updates.push({ question_id: r.question_id, next_review: day })
        placed = true
        break
      }
    }

    // Worst case: push to the end of the horizon.
    if (!placed) {
      const day = addDaysISO(today, horizonDays + 1)
      counts[day] = (counts[day] ?? 0) + 1
      updates.push({ question_id: r.question_id, next_review: day })
    }
  }

  for (const u of updates) {
    await supabase
      .from('progress')
      .update({ next_review: u.next_review })
      .eq('user_id', USER_ID)
      .eq('question_id', u.question_id)
  }
}

/**
 * Re-place all upcoming reviews (today + next horizonDays) using the current cap.
 * Fixes the case where reviews were spread with an old, smaller cap and are now
 * sitting far in the future even though today has spare capacity.
 */
export async function rebalanceReviews(horizonDays = 60): Promise<void> {
  const today = todayISOChicago()
  const horizonDate = addDaysISO(today, horizonDays)

  // All reviews up to and including the horizon (overdue + future-within-window)
  const { data } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', horizonDate)
    .order('next_review', { ascending: true })

  const rows = (data ?? []) as Array<{ question_id: number; next_review: string; review_count: number }>
  if (!rows.length) return

  // Seed counts with reviews already beyond the horizon (they hold their slot)
  const { data: beyond } = await supabase
    .from('progress')
    .select('question_id,next_review')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .gt('next_review', horizonDate)

  const counts: Record<string, number> = {}
  for (const r of beyond ?? []) {
    const day = (r as any).next_review as string
    if (day) counts[day] = (counts[day] ?? 0) + 1
  }

  const updates: Array<{ question_id: number; next_review: string }> = []

  for (const row of rows) {
    let placed = false
    // Search from today forward for the earliest day with capacity
    for (let offset = 0; offset <= horizonDays + 60; offset++) {
      const day = addDaysISO(today, offset)
      const cap = getDailyReviewCapChicago(day)
      if ((counts[day] ?? 0) < cap) {
        counts[day] = (counts[day] ?? 0) + 1
        if (row.next_review !== day) {
          updates.push({ question_id: row.question_id, next_review: day })
        }
        placed = true
        break
      }
    }
    if (!placed) {
      const day = addDaysISO(today, horizonDays + 61)
      counts[day] = (counts[day] ?? 0) + 1
      updates.push({ question_id: row.question_id, next_review: day })
    }
  }

  for (const u of updates) {
    await supabase
      .from('progress')
      .update({ next_review: u.next_review })
      .eq('user_id', USER_ID)
      .eq('question_id', u.question_id)
  }
}

/** Same rules as notify-daily email: streak day counts only when today's active daily block is fully solved AND no SR reviews are due.
 *  @param modeOverride  Pass the plan mode explicitly when known (e.g. from daily page state).
 *                       Falls back to localStorage → plan.mode → 'strict'. */
export async function syncStreakActivityFromGoals(modeOverride?: string): Promise<void> {
  const today = todayISOChicago()

  // Read mode synchronously before any awaits (localStorage available on client).
  // modeOverride wins if provided by the caller (most reliable when on the daily page).
  const localMode = typeof window !== 'undefined'
    ? (localStorage.getItem('lm_plan_mode_v1') ?? null)
    : null

  // Lightweight due-review count — plain SELECT count, no recalibrate/spread
  // side effects. getDueReviews() is too heavy here and can mis-report after
  // spreading reviews mid-flight, causing the streak to silently not get marked.
  const [plan, { count: rawDueCount }] = await Promise.all([
    getStudyPlan(),
    supabase
      .from('progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID)
      .eq('solved', true)
      .not('next_review', 'is', null)
      .lte('next_review', today),
  ])
  const dueCount = rawDueCount ?? 0

  // Priority: explicit override → localStorage → plan.mode from DB → 'strict'
  const mode = modeOverride ?? localMode ?? (plan as any)?.mode ?? 'strict'

  const clearToday = async () => {
    await supabase.from('activity_log').delete().eq('user_id', USER_ID).eq('date', today)
  }

  let goalsMet = false

  if (mode === 'random' && plan) {
    // Random mode: day done when solved_log[today] >= per_day AND reviews clear
    const solvedToday = await getTodaySolvedCount()
    goalsMet = solvedToday >= (plan.per_day ?? 1) && dueCount === 0
  } else {
    const { data: progressRows } = await supabase
      .from('progress')
      .select('question_id,solved')
      .eq('user_id', USER_ID)

    const progressMap: Record<string, { solved?: boolean }> = {}
    for (const row of progressRows ?? []) {
      const r = row as { question_id: number; solved: boolean }
      progressMap[String(r.question_id)] = { solved: !!r.solved }
    }
    goalsMet = computeDailyGoalsMetToday(plan, progressMap, dueCount)
  }

  if (goalsMet) {
    const { error } = await supabase.from('activity_log').upsert({
      user_id: USER_ID,
      date: today,
      count: 1,
    }, { onConflict: 'user_id,date' })
    if (error) console.error('[db] syncStreak: activity_log upsert failed:', error.message)
  } else {
    await clearToday()
  }
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
  // Use the same "day" definition app-wide (Chicago).
  const today = todayISOChicago()
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
  // Use the same "day" definition app-wide (Chicago).
  const today = todayISOChicago()
  const { data } = await supabase
    .from('fc_daily_log')
    .select('question_ids')
    .eq('user_id', USER_ID)
    .eq('date', today)
    .single()
  return (data?.question_ids ?? []).length
}
