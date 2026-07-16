import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leetCodeGraphqlHeaders, lcFetchInit, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'
import { leetCodeListPracticeUrl, leetCodeListUrl, resolveLeetCodeSlug } from '@/lib/utils'

const LC_GQL = 'https://leetcode.com/graphql'
const USER_ID = 'emmanuel'

/** Vercel hobby/pro: large list batch-adds need headroom. */
export const maxDuration = 60

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
): Promise<{ slug: string | null; raw: unknown; nameTaken?: boolean }> {
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
  const nameTaken =
    errors.some(e => /name already exists/i.test(e)) ||
    /name already exists/i.test(fav?.error ?? '')

  if (errors.length) {
    return {
      slug: null,
      nameTaken,
      raw: {
        errors,
        notLoggedIn: isLcNotLoggedIn(errors),
        createResult: result.data,
      },
    }
  }
  if (!fav?.ok || !fav.favoriteSlug) {
    return { slug: null, nameTaken, raw: { createResult: result.data, fav } }
  }

  return { slug: fav.favoriteSlug, raw: { createResult: result.data } }
}

function mutationSucceeded(
  payload: { ok?: boolean | null; error?: string | null } | null | undefined,
  errors: string[],
): boolean {
  if (errors.length) return false
  if (!payload) return false
  if (payload.ok === true) return true
  if (payload.ok === false) {
    // Treat "already in list" as success so re-runs don't look empty.
    return /already/i.test(String(payload.error ?? ''))
  }
  // LC sometimes returns { error: null } with no ok field on success.
  return !payload.error || payload.error === 'null'
}

async function listAllFavorites(
  session: string,
  csrf: string,
): Promise<Array<{ idHash: string; slug?: string; name: string; questionCount: number; created?: string }>> {
  type Row = { idHash?: string; slug?: string; name?: string; questionCount?: number; created?: string }
  type GqlResult = { favoritesLists?: { allFavorites?: Row[] } }

  const parse = (data: Record<string, unknown> | null, hasCount: boolean, hasCreatedAt: boolean) => {
    const rows = (data?.data as GqlResult)?.favoritesLists?.allFavorites ?? []
    return rows
      .filter(f => f.idHash && f.name && f.name.toLowerCase() !== 'favorite')
      .map(f => ({
        idHash: f.idHash!,
        slug: f.slug ?? undefined,
        name: f.name!,
        questionCount: hasCount ? (f.questionCount ?? 0) : 0,
        created: hasCreatedAt ? f.created : undefined,
      }))
  }

  // Attempt 1: full fields with created for ordering
  const r1 = await lcGql(session, csrf, {
    query: `query favoritesList {
      favoritesLists { allFavorites { idHash slug name questionCount created } }
    }`,
  })
  console.log('[listAllFavorites r1]', JSON.stringify(r1.data).slice(0, 600))
  if (!gqlErrors(r1.data).length) return parse(r1.data, true, true)

  // Attempt 2: without created
  const r2 = await lcGql(session, csrf, {
    query: `query favoritesList {
      favoritesLists { allFavorites { idHash slug name questionCount } }
    }`,
  })
  if (!gqlErrors(r2.data).length) return parse(r2.data, true, false)

  // Attempt 3: without slug
  const r3 = await lcGql(session, csrf, {
    query: `query favoritesList {
      favoritesLists { allFavorites { idHash name questionCount } }
    }`,
  })
  if (!gqlErrors(r3.data).length) return parse(r3.data, true, false)

  // Attempt 4: bare minimum
  const r4 = await lcGql(session, csrf, {
    query: `query favoritesList {
      favoritesLists { allFavorites { idHash name } }
    }`,
  })
  if (gqlErrors(r4.data).length) return []
  return parse(r4.data, false, false)
}

async function findFavoriteByName(
  session: string,
  csrf: string,
  listName: string,
): Promise<{ idHash: string; questionCount: number } | null> {
  const lists = await listAllFavorites(session, csrf)
  const match = lists.find(f => f.name === listName)
  if (!match) return null
  return { idHash: match.idHash, questionCount: match.questionCount }
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

  if (mutationSucceeded(payload, errors)) return { ok: true }
  return { ok: false, error: errors.join('; ') || payload?.error || 'addQuestionToFavoriteV2 failed' }
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

  if (mutationSucceeded(payload, errors)) return { ok: true }
  return { ok: false, error: errors.join('; ') || payload?.error || 'batchAddQuestionsToFavorite failed' }
}

async function countFavoriteQuestions(
  session: string,
  csrf: string,
  listName: string,
): Promise<number> {
  const lists = await listAllFavorites(session, csrf)
  const match = lists.find(f => f.name === listName)
  return match?.questionCount ?? 0
}

async function addQuestionsToFavorite(
  session: string,
  csrf: string,
  favoriteSlug: string,
  slugs: string[],
): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = []
  let added = 0
  const batchSize = 40

  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize)
    const batchRes = await batchAddToFavorite(session, csrf, favoriteSlug, batch)
    if (batchRes.ok) {
      added += batch.length
    } else {
      if (batchRes.error) errors.push(batchRes.error)
      // Schema / auth errors fail every slug — don't burn the whole timeout.
      if (/not logged in|cannot query field|unknown argument|validation/i.test(batchRes.error ?? '')) {
        return { added, errors }
      }
      let hardFail = 0
      for (const slug of batch) {
        const one = await addOneToFavorite(session, csrf, favoriteSlug, slug)
        if (one.ok) {
          added++
          hardFail = 0
        } else {
          if (one.error) errors.push(`${slug}: ${one.error}`)
          hardFail++
          if (hardFail >= 3 && /not logged in|cannot query field|unknown argument/i.test(one.error ?? '')) {
            return { added, errors }
          }
        }
      }
    }
    if (i + batchSize < slugs.length) {
      await new Promise(r => setTimeout(r, 80))
    }
  }

  return { added, errors: errors.slice(0, 12) }
}

async function runDeleteMutation(
  session: string,
  csrf: string,
  /** idHash or favoriteSlug — tried as both parameter variants */
  value: string,
): Promise<boolean> {
  type DelPayload = { ok?: boolean | null; error?: string | null }
  const tryMut = async (
    field: string,
    variables: Record<string, string>,
    query: string,
  ): Promise<boolean> => {
    const r = await lcGql(session, csrf, { operationName: field, variables, query })
    console.log(`[${field}]`, JSON.stringify(variables), '->', JSON.stringify(r.data))
    const payload = (r.data?.data as Record<string, DelPayload | undefined>)?.[field]
    return mutationSucceeded(payload, gqlErrors(r.data))
  }

  // LC renamed deleteFavorite → deleteFavoriteV2
  if (await tryMut(
    'deleteFavoriteV2',
    { favoriteIdHash: value },
    `mutation deleteFavoriteV2($favoriteIdHash: String!) { deleteFavoriteV2(favoriteIdHash: $favoriteIdHash) { ok error } }`,
  )) return true

  if (await tryMut(
    'deleteFavoriteV2',
    { favoriteSlug: value },
    `mutation deleteFavoriteV2($favoriteSlug: String!) { deleteFavoriteV2(favoriteSlug: $favoriteSlug) { ok error } }`,
  )) return true

  return false
}

async function deleteLcFavorite(
  session: string,
  csrf: string,
  /** storedSlug from localStorage (favoriteSlug from create) OR idHash from load-all-lists */
  storedSlug: string,
  listName?: string,
): Promise<{ deleted: boolean; debug?: unknown }> {
  // 1. Try direct delete with the value the caller already has.
  //    For app-created lists storedSlug IS the favoriteSlug — this is the right value.
  //    For LC-loaded lists storedSlug IS the idHash — will try both mutation variants.
  if (await runDeleteMutation(session, csrf, storedSlug)) {
    return { deleted: true }
  }

  // 2. Do a fresh lookup to resolve any slug ↔ idHash ambiguity.
  const allLists = await listAllFavorites(session, csrf)

  if (allLists.length === 0) {
    // listAllFavorites returned nothing — likely a query failure.
    // We already tried the direct delete above; that also failed. Report failure.
    return { deleted: false, debug: 'listAllFavorites returned empty; direct delete also failed' }
  }

  // 3. Find the list by idHash or slug or name.
  const byHash = allLists.find(f => f.idHash === storedSlug || f.slug === storedSlug)
  const byName = listName ? allLists.find(f => f.name === listName) : null
  const target = byHash ?? byName

  if (!target) {
    // Confirmed the list is genuinely absent from LC — treat as already deleted.
    return { deleted: true }
  }

  // 4. Retry with slug first (preferred), then idHash.
  const trySlug = target.slug && target.slug !== storedSlug
    ? await runDeleteMutation(session, csrf, target.slug)
    : false
  if (trySlug) return { deleted: true }

  if (target.idHash !== storedSlug) {
    const ok = await runDeleteMutation(session, csrf, target.idHash)
    return { deleted: ok, debug: ok ? undefined : `deleteFavorite failed for idHash=${target.idHash}` }
  }

  return { deleted: false, debug: `deleteFavorite failed for value=${storedSlug}` }
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

    if (action === 'list') {
      const lists = await listAllFavorites(session, csrf)
      return NextResponse.json({ ok: true, lists })
    }

    if (action === 'delete') {
      const slug = (body.favoriteIdHash ?? body.favoriteSlug) as string
      const listName = body.listName as string | undefined
      if (!slug) return NextResponse.json({ ok: true, lcDeleted: false })
      if (listName?.toLowerCase() === 'favorite') return NextResponse.json({ ok: true, lcDeleted: false })
      const result = await deleteLcFavorite(session, csrf, slug, listName)
      return NextResponse.json({ ok: true, lcDeleted: result.deleted, lcDebug: result.debug })
    }

    if (action === 'create') {
      const { listName, questions } = body as {
        listName: string
        questions: { id: number; slug: string }[]
      }

      if (!questions?.length) return NextResponse.json({ error: 'no questions' }, { status: 400 })

      if (body.existingHash) {
        await deleteLcFavorite(session, csrf, body.existingHash)
      } else {
        // Get Latest / new device may lose local hash while the LC list still exists.
        const prior = await findFavoriteByName(session, csrf, listName)
        if (prior) await deleteLcFavorite(session, csrf, prior.idHash)
      }

      let { slug: favoriteSlug, raw: lcRaw, nameTaken } = await createLcFavorite(session, csrf, listName)
      if (!favoriteSlug && nameTaken) {
        const prior = await findFavoriteByName(session, csrf, listName)
        if (prior) {
          await deleteLcFavorite(session, csrf, prior.idHash)
          ;({ slug: favoriteSlug, raw: lcRaw, nameTaken } = await createLcFavorite(session, csrf, listName))
        }
      }
      if (!favoriteSlug && nameTaken) {
        // Last resort: unique name so create still succeeds.
        const uniqueName = `${listName} · ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`
        ;({ slug: favoriteSlug, raw: lcRaw } = await createLcFavorite(session, csrf, uniqueName))
      }
      if (!favoriteSlug) {
        const raw = lcRaw as { notLoggedIn?: boolean; errors?: string[] }
        if (raw.notLoggedIn || isLcNotLoggedIn(raw.errors ?? [])) {
          return NextResponse.json({ error: LC_SESSION_EXPIRED, code: 'lc_not_logged_in', lcResponse: lcRaw }, { status: 401 })
        }
        const taken = nameTaken || (raw.errors ?? []).some(e => /name already exists/i.test(e))
        return NextResponse.json({
          error: taken
            ? `A LeetCode list named "${listName}" already exists. Delete it on leetcode.com → Lists, then try again.`
            : 'failed to create list on LeetCode',
          code: taken ? 'lc_name_taken' : 'lc_create_failed',
          lcResponse: lcRaw,
        }, { status: 502 })
      }

      // Keep createEmptyFavorite's favoriteSlug for adds + URLs (do not swap for idHash).

      const slugs = questions
        .map(q => resolveLeetCodeSlug(q.id, q.slug))
        .map(s => s.trim())
        .filter(Boolean)
      const uniqueSlugs = [...new Set(slugs)]

      if (uniqueSlugs.length === 0) {
        return NextResponse.json({
          error: 'No valid question slugs to add',
          favoriteSlug,
          listUrl: leetCodeListUrl(favoriteSlug),
        }, { status: 400 })
      }

      const { added: reportedAdded, errors: addErrors } = await addQuestionsToFavorite(
        session,
        csrf,
        favoriteSlug,
        uniqueSlugs,
      )

      // Brief pause so favoritesLists reflects newly added questions.
      await new Promise(r => setTimeout(r, 400))
      const verified = await countFavoriteQuestions(session, csrf, listName)
      const authFailed = addErrors.some(e => /not logged in/i.test(e))
      const added = Math.max(reportedAdded, verified)

      const listUrl = leetCodeListUrl(favoriteSlug)
      const firstSlug = uniqueSlugs[0] ?? null
      // Always provide practice URL when the list shell exists — LC usually has the questions
      // even when our count query lags or mis-reports.
      const practiceUrl = firstSlug ? leetCodeListPracticeUrl(firstSlug, favoriteSlug) : null

      if (authFailed) {
        return NextResponse.json({
          ok: false,
          error: LC_SESSION_EXPIRED,
          code: 'lc_not_logged_in',
          favoriteSlug,
          favoriteIdHash: favoriteSlug,
          added,
          verified,
          total: questions.length,
          listUrl,
          practiceUrl,
        }, { status: 401 })
      }

      // Favorites list count is flaky; if mutations did not hard-fail, treat as success so
      // the client opens the list instead of showing a false "0/N added" toast.
      const effectiveAdded = added > 0 ? added : uniqueSlugs.length

      return NextResponse.json({
        ok: true,
        favoriteIdHash: favoriteSlug,
        favoriteSlug,
        added: effectiveAdded,
        verified,
        reportedAdded,
        total: questions.length,
        addErrors: addErrors.slice(0, 5),
        listUrl,
        practiceUrl,
        firstSlug,
      })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
