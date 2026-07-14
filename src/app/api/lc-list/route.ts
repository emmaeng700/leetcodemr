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
  try { return { ok: res.ok, data: JSON.parse(text) } } catch { return { ok: false, data: null } }
}

async function createLcFavorite(session: string, csrf: string, name: string): Promise<string | null> {
  const result = await lcGql(session, csrf, {
    operationName: 'createFavorite',
    variables: { name, isPublicFavorite: false },
    query: `mutation createFavorite($name: String!, $isPublicFavorite: Boolean!) {
      createFavorite(name: $name, isPublicFavorite: $isPublicFavorite) {
        ok error name favoriteIdHash isPublicFavorite
      }
    }`,
  })
  return result.data?.data?.createFavorite?.favoriteIdHash ?? null
}

async function addToFavorite(session: string, csrf: string, favoriteIdHash: string, questionId: number): Promise<boolean> {
  const result = await lcGql(session, csrf, {
    operationName: 'addQuestionToFavorite',
    variables: { favoriteIdHash, questionId },
    query: `mutation addQuestionToFavorite($favoriteIdHash: String!, $questionId: Int!) {
      addQuestionToFavorite(favoriteIdHash: $favoriteIdHash, questionId: $questionId) {
        ok error
      }
    }`,
  })
  return result.data?.data?.addQuestionToFavorite?.ok === true
}

async function deleteLcFavorite(session: string, csrf: string, favoriteIdHash: string): Promise<boolean> {
  const result = await lcGql(session, csrf, {
    operationName: 'deleteFavorite',
    variables: { favoriteIdHash },
    query: `mutation deleteFavorite($favoriteIdHash: String!) {
      deleteFavorite(favoriteIdHash: $favoriteIdHash) { ok error }
    }`,
  })
  return result.data?.data?.deleteFavorite?.ok === true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    const { session, csrf } = await getLcSession()
    if (!session) return NextResponse.json({ error: 'no LC session' }, { status: 401 })

    if (action === 'delete') {
      const { favoriteIdHash } = body as { favoriteIdHash: string }
      if (!favoriteIdHash) return NextResponse.json({ ok: true })
      await deleteLcFavorite(session, csrf, favoriteIdHash)
      return NextResponse.json({ ok: true })
    }

    if (action === 'create') {
      const { listName, questions } = body as {
        listName: string
        questions: { id: number; slug: string }[]
      }

      if (!questions?.length) return NextResponse.json({ error: 'no questions' }, { status: 400 })

      // Delete existing list if hash provided (replace it)
      if (body.existingHash) {
        await deleteLcFavorite(session, csrf, body.existingHash)
      }

      const favoriteIdHash = await createLcFavorite(session, csrf, listName)
      if (!favoriteIdHash) return NextResponse.json({ error: 'failed to create list on LeetCode — session may be stale' }, { status: 502 })

      // Add questions in batches of 5 with a delay between batches
      let added = 0
      const batchSize = 5
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(q => addToFavorite(session, csrf, favoriteIdHash, q.id).then(ok => { if (ok) added++ }))
        )
        if (i + batchSize < questions.length) {
          await new Promise(r => setTimeout(r, 300))
        }
      }

      return NextResponse.json({
        ok: true,
        favoriteIdHash,
        added,
        total: questions.length,
        listUrl: `https://leetcode.com/list/?selectedList=${favoriteIdHash}`,
      })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
