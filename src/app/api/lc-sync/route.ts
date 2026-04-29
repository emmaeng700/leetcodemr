import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeLcCookieHeader } from '@/lib/leetcodeHttp'
import questionsRaw from '../../../../public/questions_full.json'

/** Chicago date string — keeps SR dates consistent with the rest of the app. */
function todayChicago() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

/** Add `days` to an ISO date string and return a new ISO date string. */
function addDaysISO(base: string, days: number) {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function isWeekendChicago(dateISOChicago: string) {
  const weekday = new Date(dateISOChicago + 'T12:00:00').toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  })
  return weekday === 'Sat' || weekday === 'Sun'
}

function getDailyReviewCapChicago(dateISOChicago: string) {
  return isWeekendChicago(dateISOChicago) ? 60 : 35
}

function spreadFirstReviewDates(
  today: string,
  existingCounts: Record<string, number>,
  count: number,
  startOffset = 7,
  horizonDays = 120,
) {
  const counts = existingCounts
  const dates: string[] = []

  for (let i = 0; i < count; i++) {
    let assigned: string | null = null
    for (let offset = startOffset; offset <= horizonDays; offset++) {
      const day = addDaysISO(today, offset)
      const cap = getDailyReviewCapChicago(day)
      if ((counts[day] ?? 0) < cap) {
        counts[day] = (counts[day] ?? 0) + 1
        assigned = day
        break
      }
    }

    if (!assigned) {
      assigned = addDaysISO(today, horizonDays + 1 + i)
      counts[assigned] = (counts[assigned] ?? 0) + 1
    }

    dates.push(assigned)
  }

  return dates
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const USER_ID = 'emmanuel'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// slug → app question id
const SLUG_TO_ID: Record<string, number> = {}
for (const q of questionsRaw as { id: number; slug: string }[]) {
  SLUG_TO_ID[q.slug] = q.id
}

export async function POST() {
  // 1. Load stored session
  const { data: settings } = await supabase
    .from('user_settings')
    .select('lc_session, lc_csrf')
    .eq('user_id', USER_ID)
    .single()

  const session = settings?.lc_session ?? ''
  const csrf = settings?.lc_csrf ?? ''

  if (!session) {
    return NextResponse.json(
      { error: 'No LeetCode session saved. Connect your session first.' },
      { status: 400 },
    )
  }

  const { cookie } = normalizeLcCookieHeader(session, csrf)

  // 2. Fetch all problems + submission status from LeetCode
  const lcRes = await fetch('https://leetcode.com/api/problems/all/', {
    headers: {
      Cookie: cookie,
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://leetcode.com/problemset/',
    },
    cache: 'no-store',
  })

  if (!lcRes.ok) {
    return NextResponse.json(
      { error: `LeetCode returned ${lcRes.status}. Your session may have expired.` },
      { status: 502 },
    )
  }

  const lcData = await lcRes.json()
  const pairs: { stat: { question__title_slug: string }; status: string | null }[] =
    lcData?.stat_status_pairs ?? []

  if (!pairs.length) {
    return NextResponse.json(
      { error: 'Could not read problem list from LeetCode. Session may be invalid.' },
      { status: 502 },
    )
  }

  // 3. Find which app questions have been accepted on LeetCode
  const acSlugs = pairs
    .filter(p => p.status === 'ac')
    .map(p => p.stat.question__title_slug)

  const matchedIds = acSlugs
    .map(slug => SLUG_TO_ID[slug])
    .filter((id): id is number => id !== undefined)

  if (!matchedIds.length) {
    return NextResponse.json({ synced: 0 })
  }

  // 4. Load existing progress to avoid overwriting richer data (notes, starred, etc.)
  const { data: existing } = await supabase
    .from('progress')
    .select('question_id, solved, starred, notes, status, review_count, next_review, last_reviewed')
    .eq('user_id', USER_ID)
    .in('question_id', matchedIds)

  const existingMap: Record<number, Record<string, unknown>> = {}
  for (const row of existing ?? []) {
    existingMap[row.question_id] = row
  }

  const { data: scheduledRows } = await supabase
    .from('progress')
    .select('question_id,next_review')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)

  const scheduledCounts: Record<string, number> = {}
  for (const row of scheduledRows ?? []) {
    if (matchedIds.includes(row.question_id)) continue
    const day = row.next_review as string | null
    if (!day) continue
    scheduledCounts[day] = (scheduledCounts[day] ?? 0) + 1
  }

  // Only upsert questions not yet marked solved in the app
  const today = todayChicago()
  const idsToUpsert = matchedIds.filter(id => !existingMap[id]?.solved)
  const firstReviewDates = spreadFirstReviewDates(today, scheduledCounts, idsToUpsert.length, 7)

  const toUpsert = idsToUpsert.map((id, index) => {
      const ex = existingMap[id] ?? {}
      const reviewCount = (ex.review_count as number) ?? 0
      // Schedule first SR review starting 7 days out, then spread across future days
      // so a large sync doesn't dump everything onto one date.
      const nextReview = (ex.next_review as string | null) ?? firstReviewDates[index]
      return {
        user_id: USER_ID,
        question_id: id,
        solved: true,
        starred: ex.starred ?? false,
        notes: ex.notes ?? '',
        status: ex.status ?? null,
        review_count: reviewCount,
        next_review: nextReview,
        last_reviewed: (ex.last_reviewed as string | null) ?? today,
        updated_at: new Date().toISOString(),
      }
    })

  if (toUpsert.length) {
    const { error } = await supabase
      .from('progress')
      .upsert(toUpsert, { onConflict: 'user_id,question_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // 5. Backfill: questions already marked solved in the app but missing next_review
  //    (synced before this fix). Give them the same 7-day first-review delay.
  const toBackfill = matchedIds.filter(id => {
    const ex = existingMap[id]
    return ex?.solved === true && !ex?.next_review
  })

  let backfilled = 0
  if (toBackfill.length) {
    const backfillDates = spreadFirstReviewDates(today, scheduledCounts, toBackfill.length, 7)
    let errorFound = false
    for (const [index, questionId] of toBackfill.entries()) {
      const { error } = await supabase
        .from('progress')
        .update({
          next_review: backfillDates[index],
          last_reviewed: today,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', USER_ID)
        .eq('question_id', questionId)
        .is('next_review', null)
      if (error) {
        errorFound = true
        break
      }
    }

    if (!errorFound) backfilled = toBackfill.length
  }

  return NextResponse.json({
    synced: toUpsert.length,
    backfilled,
    total_ac: acSlugs.length,
    total_matched: matchedIds.length,
  })
}
