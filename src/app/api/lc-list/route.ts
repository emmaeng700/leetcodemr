import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leetCodeGraphqlHeaders, lcFetchInit, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'

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
    return { slug: null, raw: { errors, createResult: result.data } }
  }
  if (!fav?.ok || !fav.favoriteSlug) {
    return { slug: null, raw: { createResult: result.data, fav } }
  }

  return { slug: fav.favoriteSlug, raw: { createResult: result.data } }
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
    query: `mutation batchAddQuestionsToFavorite($favoriteSlug: String!, $questionSlugs: [String!]!) {
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

async function deleteLcFavorite(session: string, csrf: string, favoriteSlug: string): Promise<boolean> {
  const result = await lcGql(session, csrf, {
    operationName: 'resetFavoriteSessionV2',
    variables: { favoriteSlug, deleteSyncedCode: true },
    query: `mutation resetFavoriteSessionV2($favoriteSlug: String!, $deleteSyncedCode: Boolean) {
      resetFavoriteSessionV2(favoriteSlug: $favoriteSlug, deleteSyncedCode: $deleteSyncedCode) {
        ok
        error
      }
    }`,
  })

  const payload = (result.data?.data as { resetFavoriteSessionV2?: { ok?: boolean } })?.resetFavoriteSessionV2
  return payload?.ok === true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    let session: string = body.session ?? ''
    let csrf: string = body.csrf ?? ''
    if (!session) {
      const creds = await getLcSession()
      session = creds.session
      csrf = creds.csrf
    }
    if (!session) return NextResponse.json({ error: 'no LC session' }, { status: 401 })

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
        return NextResponse.json({ error: 'failed to create list on LeetCode', lcResponse: lcRaw }, { status: 502 })
      }

      const slugs = questions.map(q => q.slug).filter(Boolean)
      let added = 0
      const batchSize = 40
      for (let i = 0; i < slugs.length; i += batchSize) {
        const batch = slugs.slice(i, i + batchSize)
        const res = await batchAddToFavorite(session, csrf, favoriteSlug, batch)
        if (res.ok) added += batch.length
        if (i + batchSize < slugs.length) {
          await new Promise(r => setTimeout(r, 250))
        }
      }

      return NextResponse.json({
        ok: true,
        favoriteIdHash: favoriteSlug,
        favoriteSlug,
        added,
        total: questions.length,
        listUrl: `https://leetcode.com/problem-list/${favoriteSlug}`,
      })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
