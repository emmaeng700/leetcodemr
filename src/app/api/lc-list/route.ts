import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leetCodeGraphqlHeaders, lcFetchInit, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'
import { resolveLeetCodeSlug } from '@/lib/utils'

const LC_GQL = 'https://leetcode.com/graphql'
const USER_ID = 'emmanuel'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

async function getLcSession(): Promise<{ session: string; csrf: string }> {
  const { data } = await supabase()
    .from('user_settings')
    .select('lc_session, lc_csrf')
    .eq('user_id', USER_ID)
    .single()
  if (!data?.lc_session) return { session: '', csrf: '' }
  return resolveLcSessionCredentials(data.lc_session, data.lc_csrf)
}

async function lcGql(session: string, csrf: string, body: object) {
  const res = await fetch(LC_GQL, {
    method: 'POST',
    headers: leetCodeGraphqlHeaders(session, csrf),
    body: JSON.stringify(body),
    ...lcFetchInit,
  })
  const text = await res.text()
  try {
    return { ok: res.ok, data: JSON.parse(text) as Record<string, unknown> }
  } catch {
    return { ok: false, data: null }
  }
}

function gqlErrors(data: Record<string, unknown> | null): string[] {
  const errs = data?.errors
  if (!Array.isArray(errs)) return []
  return errs.map(e => String((e as { message?: string })?.message ?? e))
}

function isLcNotLoggedIn(errors: string[]): boolean {
  return errors.some(e => /not logged in/i.test(e))
}

const LC_SESSION_EXPIRED =
  'LeetCode session expired. Open leetcode.com (logged in) → F12 → Network → any request → copy Cookie header → Clipboard → Use.'

async function resolveRequestSession(
  body: Record<string, unknown>,
): Promise<{ session: string; csrf: string; error?: string }> {
  let session = String(body.session ?? body.lc_session ?? '')
  let csrf = String(body.csrf ?? body.csrfToken ?? body.lc_csrf ?? '')

  const tryResolve = async (s: string, c: string) => {
    if (!s) return { session: '', csrf: '' }
    const resolved = await resolveLcSessionCredentials(s, c)
    return { session: resolved.session, csrf: resolved.csrf }
  }

  if (session) {
    const first = await tryResolve(session, csrf)
    session = first.session
    csrf = first.csrf
  } else {
    const fromDb = await getLcSession()
    session = fromDb.session
    csrf = fromDb.csrf
  }

  if (!session) return { session: '', csrf: '', error: 'no LC session' }
  if (!csrf) return { session, csrf: '', error: LC_SESSION_EXPIRED }

  const probe = await lcGql(session, csrf, {
    query: '{ favoritesLists { allFavorites { name } } }',
  })
  const probeErrors = gqlErrors(probe.data)
  if (!isLcNotLoggedIn(probeErrors)) {
    return { session, csrf }
  }

  // Client session stale — try Supabase copy once.
  const fromDb = await getLcSession()
  if (fromDb.session && fromDb.session !== session) {
    const retry = await tryResolve(fromDb.session, fromDb.csrf)
    if (retry.session && retry.csrf) {
      const probe2 = await lcGql(retry.session, retry.csrf, {
        query: '{ favoritesLists { allFavorites { name } } }',
      })
      if (!isLcNotLoggedIn(gqlErrors(probe2.data))) {
        return { session: retry.session, csrf: retry.csrf }
      }
    }
  }

  return { session, csrf, error: LC_SESSION_EXPIRED }
}

async function createLcFavorite(
  session: string,
  csrf: string,
  name: string,
): Promise<{ slug: string | null; raw: unknown }> {
  const result = await lcGql(session, csrf, {
    operationName: 'createEmptyFavorite',
    variables: {
      name,
      description: '',
      favoriteType: 'NORMAL',
      isPublicFavorite: false,
    },
    query: `mutation createEmptyFavorite($name: String!, $description: String, $favoriteType: FavoriteTypeEnum!, $isPublicFavorite: Boolean) {
      createEmptyFavorite(
        name: $name,
        description: $description,
        favoriteType: $favoriteType,
        isPublicFavorite: $isPublicFavorite
      ) {
        ok
        error
        favoriteSlug
      }
    }`,
  })

  const errors = gqlErrors(result.data)
  const fav = (result.data?.data as { createEmptyFavorite?: { ok?: boolean; error?: string; favoriteSlug?: string } })
    ?.createEmptyFavorite

  if (errors.length) {
    return {
      slug: null,
      raw: {
        errors,
        notLoggedIn: isLcNotLoggedIn(errors),
        createResult: result.data,
      },
    }
  }
  if (!fav?.ok || !fav.favoriteSlug) {
    return { slug: null, raw: { createResult: result.data, fav } }
  }

  return { slug: fav.favoriteSlug, raw: { createResult: result.data } }
}

async function addOneToFavorite(
  session: string,
  csrf: string,
  favoriteSlug: string,
  questionSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await lcGql(session, csrf, {
    operationName: 'addQuestionToFavoriteV2',
    variables: { favoriteSlug, questionSlug },
    query: `mutation addQuestionToFavoriteV2($favoriteSlug: String!, $questionSlug: String!) {
      addQuestionToFavoriteV2(favoriteSlug: $favoriteSlug, questionSlug: $questionSlug) {
        ok
        error
      }
    }`,
  })

  const errors = gqlErrors(result.data)
  const payload = (result.data?.data as { addQuestionToFavoriteV2?: { ok?: boolean; error?: string } })
    ?.addQuestionToFavoriteV2

  if (errors.length) return { ok: false, error: errors.join('; ') }
  return { ok: payload?.ok === true, error: payload?.error }
}

async function batchAddToFavorite(
  session: string,
  csrf: string,
  favoriteSlug: string,
  questionSlugs: string[],
): Promise<{ ok: boolean; error?: string }> {
  const result = await lcGql(session, csrf, {
    operationName: 'batchAddQuestionsToFavorite',
    variables: { favoriteSlug, questionSlugs },
    query: `mutation batchAddQuestionsToFavorite($favoriteSlug: String!, $questionSlugs: [String]!) {
      batchAddQuestionsToFavorite(favoriteSlug: $favoriteSlug, questionSlugs: $questionSlugs) {
        ok
        error
      }
    }`,
  })

  const errors = gqlErrors(result.data)
  const payload = (result.data?.data as { batchAddQuestionsToFavorite?: { ok?: boolean; error?: string } })
    ?.batchAddQuestionsToFavorite

  if (errors.length) return { ok: false, error: errors.join('; ') }
  return { ok: payload?.ok === true, error: payload?.error }
}

async function countFavoriteQuestions(
  session: string,
  csrf: string,
  favoriteSlug: string,
  listName: string,
): Promise<number> {
  const result = await lcGql(session, csrf, {
    query: `query favoritesList {
      favoritesLists {
        allFavorites {
          idHash
          name
          slug
          questions { titleSlug }
        }
      }
    }`,
  })

  const lists = (result.data?.data as {
    favoritesLists?: { allFavorites?: Array<{ idHash?: string; name?: string; slug?: string; questions?: unknown[] }> }
  })?.favoritesLists?.allFavorites ?? []

  const match = lists.find(f =>
    f.slug === favoriteSlug ||
    f.idHash === favoriteSlug ||
    f.name === listName,
  )
  return match?.questions?.length ?? 0
}

async function addQuestionsToFavorite(
  session: string,
  csrf: string,
  favoriteSlug: string,
  slugs: string[],
): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = []
  let added = 0
  const batchSize = 10

  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize)
    const batchRes = await batchAddToFavorite(session, csrf, favoriteSlug, batch)
    if (batchRes.ok) {
      added += batch.length
    } else {
      if (batchRes.error) errors.push(batchRes.error)
      for (const slug of batch) {
        const one = await addOneToFavorite(session, csrf, favoriteSlug, slug)
        if (one.ok) added++
        else if (one.error) errors.push(`${slug}: ${one.error}`)
        await new Promise(r => setTimeout(r, 120))
      }
    }
    if (i + batchSize < slugs.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return { added, errors }
}

async function deleteLcFavorite(session: string, csrf: string, favoriteSlug: string): Promise<boolean> {
  const result = await lcGql(session, csrf, {
    operationName: 'deleteFavorite',
    variables: { favoriteSlug },
    query: `mutation deleteFavorite($favoriteSlug: String!) {
      deleteFavorite(favoriteSlug: $favoriteSlug) { ok error }
    }`,
  })

  const payload = (result.data?.data as { deleteFavorite?: { ok?: boolean } })?.deleteFavorite
  if (payload?.ok === true) return true

  const fallback = await lcGql(session, csrf, {
    operationName: 'deleteFavorite',
    variables: { favoriteIdHash: favoriteSlug },
    query: `mutation deleteFavorite($favoriteIdHash: String!) {
      deleteFavorite(favoriteIdHash: $favoriteIdHash) { ok error }
    }`,
  })
  const fb = (fallback.data?.data as { deleteFavorite?: { ok?: boolean } })?.deleteFavorite
  return fb?.ok === true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    const { session, csrf, error: sessionError } = await resolveRequestSession(body)
    if (!session) {
      return NextResponse.json({ error: sessionError ?? 'no LC session', code: 'lc_no_session' }, { status: 401 })
    }
    if (!csrf || sessionError) {
      return NextResponse.json({ error: sessionError ?? LC_SESSION_EXPIRED, code: 'lc_not_logged_in' }, { status: 401 })
    }

    if (action === 'delete') {
      const slug = (body.favoriteIdHash ?? body.favoriteSlug) as string
      if (!slug) return NextResponse.json({ ok: true })
      await deleteLcFavorite(session, csrf, slug)
      return NextResponse.json({ ok: true })
    }

    if (action === 'create') {
      const { listName, questions } = body as {
        listName: string
        questions: { id: number; slug: string }[]
      }

      if (!questions?.length) return NextResponse.json({ error: 'no questions' }, { status: 400 })

      if (body.existingHash) {
        await deleteLcFavorite(session, csrf, body.existingHash)
      }

      const { slug: favoriteSlug, raw: lcRaw } = await createLcFavorite(session, csrf, listName)
      if (!favoriteSlug) {
        const raw = lcRaw as { notLoggedIn?: boolean; errors?: string[] }
        if (raw.notLoggedIn || isLcNotLoggedIn(raw.errors ?? [])) {
          return NextResponse.json({ error: LC_SESSION_EXPIRED, code: 'lc_not_logged_in', lcResponse: lcRaw }, { status: 401 })
        }
        return NextResponse.json({ error: 'failed to create list on LeetCode', lcResponse: lcRaw }, { status: 502 })
      }

      const slugs = questions
        .map(q => resolveLeetCodeSlug(q.id, q.slug))
        .filter(Boolean)
      const uniqueSlugs = [...new Set(slugs)]

      const { added: reportedAdded, errors: addErrors } = await addQuestionsToFavorite(
        session,
        csrf,
        favoriteSlug,
        uniqueSlugs,
      )

      const verified = await countFavoriteQuestions(session, csrf, favoriteSlug, listName)
      const added = Math.max(reportedAdded, verified)

      if (added === 0) {
        return NextResponse.json({
          error: 'List created but no questions were added',
          favoriteSlug,
          lcResponse: { addErrors, createResult: lcRaw },
        }, { status: 502 })
      }

      const firstSlug = uniqueSlugs[0] ?? null
      const practiceUrl = firstSlug
        ? `https://leetcode.com/problems/${encodeURIComponent(firstSlug)}/?envType=favorite-list&envId=${encodeURIComponent(favoriteSlug)}`
        : null

      return NextResponse.json({
        ok: true,
        favoriteIdHash: favoriteSlug,
        favoriteSlug,
        added,
        verified,
        total: questions.length,
        addErrors: addErrors.slice(0, 5),
        listUrl: `https://leetcode.com/problem-list/${favoriteSlug}`,
        practiceUrl,
        firstSlug,
      })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
