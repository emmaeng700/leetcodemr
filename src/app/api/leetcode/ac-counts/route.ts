import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { lcFetchInit, leetCodeGraphqlHeaders, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'

const LC_GRAPHQL = 'https://leetcode.com/graphql'
const USER_ID = 'emmanuel'

const LC_SESSION_EXPIRED =
  'LeetCode session expired. Open leetcode.com (logged in) → F12 → Network → copy Cookie → Clipboard → Use.'

const AC_LIST_QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data {
      titleSlug
    }
  }
}`

const SUBMISSION_QUERY = `query AcCountPage($offset: Int!, $limit: Int!, $lastKey: String) {
  submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
    lastKey
    hasNext
    submissions {
      statusDisplay
      titleSlug
    }
  }
}`

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function gqlErrors(data: unknown): string[] {
  const errs = (data as { errors?: Array<{ message?: string }> })?.errors
  if (!Array.isArray(errs)) return []
  return errs.map(e => String(e?.message ?? e))
}

function isLcNotLoggedIn(errors: string[]): boolean {
  return errors.some(e => /not logged in/i.test(e))
}

async function lcGql(session: string, csrf: string, body: object) {
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST',
    headers: leetCodeGraphqlHeaders(session, csrf),
    body: JSON.stringify(body),
    ...lcFetchInit,
  })
  const text = await res.text()
  const parsed = parseLeetCodeJsonText(text, res.status)
  if (!parsed.ok) {
    return { ok: false as const, data: null, parseError: parsed.error }
  }
  return { ok: true as const, data: parsed.data as Record<string, unknown>, parseError: null }
}

async function getDbSession(): Promise<{ session: string; csrf: string }> {
  const { data } = await supabase
    .from('user_settings')
    .select('lc_session, lc_csrf')
    .eq('user_id', USER_ID)
    .single()
  if (!data?.lc_session) return { session: '', csrf: '' }
  return resolveLcSessionCredentials(data.lc_session, data.lc_csrf)
}

async function resolveRequestSession(body: Record<string, unknown>): Promise<{ session: string; csrf: string; error?: string }> {
  let session = String(body.session ?? body.lc_session ?? '')
  let csrf = String(body.csrfToken ?? body.csrf ?? body.lc_csrf ?? '')

  const resolve = async (s: string, c: string) => {
    if (!s) return { session: '', csrf: '' }
    const r = await resolveLcSessionCredentials(s, c)
    return { session: r.session, csrf: r.csrf }
  }

  if (session) {
    const first = await resolve(session, csrf)
    session = first.session
    csrf = first.csrf
  } else {
    const fromDb = await getDbSession()
    session = fromDb.session
    csrf = fromDb.csrf
  }

  if (!session) return { session: '', csrf: '', error: 'no_session' }
  if (!csrf) return { session, csrf: '', error: LC_SESSION_EXPIRED }

  const probe = await lcGql(session, csrf, {
    query: '{ favoritesLists { allFavorites { name } } }',
  })
  if (probe.ok) {
    const errors = gqlErrors(probe.data)
    if (!isLcNotLoggedIn(errors)) return { session, csrf }
  }

  const fromDb = await getDbSession()
  if (fromDb.session && fromDb.session !== session) {
    const retry = await resolve(fromDb.session, fromDb.csrf)
    if (retry.session && retry.csrf) {
      const probe2 = await lcGql(retry.session, retry.csrf, {
        query: '{ favoritesLists { allFavorites { name } } }',
      })
      if (probe2.ok && !isLcNotLoggedIn(gqlErrors(probe2.data))) {
        return { session: retry.session, csrf: retry.csrf }
      }
    }
  }

  return { session, csrf, error: LC_SESSION_EXPIRED }
}

/** Primary: LeetCode problemset filter status=AC (canonical solved list). */
async function fetchAcByProblemList(
  session: string,
  csrf: string,
): Promise<{ bySlug: Record<string, number>; error?: string }> {
  const bySlug: Record<string, number> = {}
  const limit = 100
  let skip = 0
  let total = Number.POSITIVE_INFINITY

  for (let page = 0; page < 100 && skip < total; page++) {
    const result = await lcGql(session, csrf, {
      operationName: 'problemsetQuestionList',
      query: AC_LIST_QUERY,
      variables: {
        categorySlug: '',
        skip,
        limit,
        filters: { status: 'AC' },
      },
    })

    if (!result.ok) {
      return { bySlug: {}, error: result.parseError === 'non_json_html' ? LC_SESSION_EXPIRED : 'Could not load AC list.' }
    }

    const errors = gqlErrors(result.data)
    if (errors.length) {
      if (isLcNotLoggedIn(errors)) return { bySlug: {}, error: LC_SESSION_EXPIRED }
      return { bySlug: {}, error: errors.join('; ') }
    }

    const list = (result.data?.data as {
      problemsetQuestionList?: { total?: number; questions?: Array<{ titleSlug?: string }> }
    })?.problemsetQuestionList

    if (!list) break
    total = list.total ?? skip

    for (const q of list.questions ?? []) {
      if (q.titleSlug) bySlug[q.titleSlug] = 1
    }

    skip += limit
    if ((list.questions?.length ?? 0) < limit) break
  }

  return { bySlug }
}

/** Fallback: paginate global submission history. */
async function fetchAcBySubmissions(
  session: string,
  csrf: string,
): Promise<{ bySlug: Record<string, number>; error?: string }> {
  const bySlug: Record<string, number> = {}
  let lastKey: string | null = null
  const limit = 20

  for (let page = 0; page < 600; page++) {
    const result = await lcGql(session, csrf, {
      operationName: 'AcCountPage',
      query: SUBMISSION_QUERY,
      variables: { offset: 0, limit, lastKey },
    })

    if (!result.ok) {
      return { bySlug: {}, error: 'Could not load submission history.' }
    }

    const errors = gqlErrors(result.data)
    if (errors.length) {
      if (isLcNotLoggedIn(errors)) return { bySlug: {}, error: LC_SESSION_EXPIRED }
      return { bySlug: {}, error: errors.join('; ') }
    }

    const list = (result.data?.data as {
      submissionList?: {
        lastKey?: string | null
        hasNext?: boolean
        submissions?: Array<{ statusDisplay?: string; titleSlug?: string }>
      }
    })?.submissionList

    if (!list) break

    for (const s of list.submissions ?? []) {
      if (s.statusDisplay === 'Accepted' && s.titleSlug) {
        bySlug[s.titleSlug] = (bySlug[s.titleSlug] ?? 0) + 1
      }
    }

    if (!list.hasNext) break
    lastKey = list.lastKey ?? null
    if (!lastKey) break
  }

  return { bySlug }
}

/** Accepted problem slugs from the user's LeetCode session. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty body */
  }

  const { session, csrf, error: sessionError } = await resolveRequestSession(body)
  if (!session) {
    return NextResponse.json({ bySlug: {}, error: sessionError ?? 'no_session', code: 'lc_no_session' })
  }
  if (!csrf || sessionError) {
    return NextResponse.json({ bySlug: {}, error: sessionError ?? LC_SESSION_EXPIRED, code: 'lc_not_logged_in' })
  }

  let { bySlug, error } = await fetchAcByProblemList(session, csrf)

  if (Object.keys(bySlug).length === 0 && !error) {
    const fallback = await fetchAcBySubmissions(session, csrf)
    bySlug = fallback.bySlug
    error = fallback.error
  }

  if (error && Object.keys(bySlug).length === 0) {
    return NextResponse.json({
      bySlug: {},
      error,
      code: /not logged in|expired/i.test(error) ? 'lc_not_logged_in' : 'lc_sync_failed',
    }, { status: /not logged in|expired/i.test(error) ? 401 : 502 })
  }

  return NextResponse.json({ bySlug })
}
