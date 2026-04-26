import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeLcCookieHeader } from '@/lib/leetcodeHttp'
import questionsRaw from '../../../../public/questions_full.json'

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

  // Only upsert questions not yet marked solved in the app
  const toUpsert = matchedIds
    .filter(id => !existingMap[id]?.solved)
    .map(id => {
      const ex = existingMap[id] ?? {}
      return {
        user_id: USER_ID,
        question_id: id,
        solved: true,
        starred: ex.starred ?? false,
        notes: ex.notes ?? '',
        status: ex.status ?? null,
        review_count: ex.review_count ?? 0,
        next_review: ex.next_review ?? null,
        last_reviewed: ex.last_reviewed ?? null,
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

  return NextResponse.json({
    synced: toUpsert.length,
    total_ac: acSlugs.length,
    total_matched: matchedIds.length,
  })
}
