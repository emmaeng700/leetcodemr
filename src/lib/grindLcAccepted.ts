/**
 * Grind editor: third learning section = latest accepted LeetCode submission.
 * Fetched while online, cached in localStorage for offline Grind.
 */

import type { GrindLang } from '@/lib/grindStorage'
import { getCookieFromHeader } from '@/lib/leetcodeHttp'
import { lcFetch } from '@/lib/leetcodeLocalConnector'
import { readLcListSync } from '@/lib/leetcodeListSync'

export const ACCEPTED_MARKER_PY = '# -- Your LeetCode Accepted --'
export const ACCEPTED_MARKER_CPP = '// -- Your LeetCode Accepted --'

export type GrindLcAcceptedCache = {
  code: string
  fetchedAt: string
  empty: boolean
}

/** How we resolved accepted code for the editor section. */
export type GrindLcAcceptedResolve =
  | { status: 'ready'; code: string }
  | { status: 'empty' }
  | { status: 'uncached' }
  | { status: 'skipped' }

export type GrindLcAcceptedPrefetchProgress = {
  done: number
  total: number
  cached: number
  running: boolean
}

function cacheKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_lc_ac_${questionId}_${lang}`
}

export function acceptedMarker(lang: GrindLang): string {
  return lang === 'python3' ? ACCEPTED_MARKER_PY : ACCEPTED_MARKER_CPP
}

export function readGrindLcAcceptedCache(
  questionId: number,
  lang: GrindLang,
): GrindLcAcceptedCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(questionId, lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GrindLcAcceptedCache>
    if (typeof parsed.code !== 'string' || typeof parsed.fetchedAt !== 'string') return null
    return {
      code: parsed.code,
      fetchedAt: parsed.fetchedAt,
      empty: parsed.empty === true || !parsed.code.trim(),
    }
  } catch {
    return null
  }
}

export function writeGrindLcAcceptedCache(
  questionId: number,
  lang: GrindLang,
  code: string,
): void {
  if (typeof window === 'undefined') return
  const entry: GrindLcAcceptedCache = {
    code: code.trim(),
    fetchedAt: new Date().toISOString(),
    empty: !code.trim(),
  }
  try {
    localStorage.setItem(cacheKey(questionId, lang), JSON.stringify(entry))
  } catch { /* quota */ }
}

export function countCachedGrindLcAccepted(
  questionIds: number[],
  lang: GrindLang,
): { ready: number; empty: number; missing: number } {
  let ready = 0
  let empty = 0
  let missing = 0
  for (const id of questionIds) {
    const c = readGrindLcAcceptedCache(id, lang)
    if (!c) missing++
    else if (c.empty) empty++
    else ready++
  }
  return { ready, empty, missing }
}

function commentLine(lang: GrindLang, text = ''): string {
  if (lang === 'python3') return text ? `# ${text}` : '#'
  return text ? `// ${text}` : '//'
}

/** Format accepted solution (or empty / uncached guidance). */
export function formatAcceptedSection(
  lang: GrindLang,
  acceptedCode: string | null,
  kind: 'ready' | 'empty' | 'uncached' = acceptedCode?.trim() ? 'ready' : 'empty',
): string {
  const marker = acceptedMarker(lang)
  const header = [
    marker,
    commentLine(lang, 'Latest accepted submission from leetcode.com (cached for offline).'),
    commentLine(lang, ''),
  ].join('\n')

  if (kind === 'uncached') {
    return [
      header,
      commentLine(lang, 'Not downloaded for offline yet.'),
      commentLine(lang, 'Stay online in Grind - it caches accepted solutions in the background.'),
    ].join('\n')
  }

  if (kind === 'empty' || !acceptedCode?.trim()) {
    return [
      header,
      commentLine(lang, 'No accepted solution found for this language yet.'),
      commentLine(lang, 'Go to LeetCode, get Accepted, then reopen Grind while online'),
      commentLine(lang, 'so it can cache this section for offline use.'),
    ].join('\n')
  }

  const body = acceptedCode.replace(/\r\n/g, '\n').trimEnd()
  return `${header}\n${body}`
}

export function starterHasAcceptedSection(code: string, lang: GrindLang): boolean {
  return code.includes(acceptedMarker(lang))
}

/** Cut everything from the accepted marker to EOF. */
export function stripAcceptedSection(code: string, lang: GrindLang): string {
  const marker = acceptedMarker(lang)
  const idx = code.indexOf(marker)
  if (idx < 0) return code
  return code.slice(0, idx).replace(/\s+$/, '')
}

export function upsertAcceptedSection(
  code: string,
  lang: GrindLang,
  acceptedCode: string | null,
  kind: 'ready' | 'empty' | 'uncached' = acceptedCode?.trim() ? 'ready' : 'empty',
): string {
  const section = formatAcceptedSection(lang, acceptedCode, kind)
  const without = stripAcceptedSection(code, lang)
  const base = without.replace(/\s+$/, '')
  return `${base}\n\n\n\n${section}\n`
}

function grindLangToLc(lang: GrindLang): 'python' | 'cpp' {
  return lang === 'python3' ? 'python' : 'cpp'
}

function getLcCredentials(): { session: string; csrfToken: string } {
  if (typeof window === 'undefined') return { session: '', csrfToken: '' }
  const session = localStorage.getItem('lc_session') ?? ''
  const csrfToken =
    (localStorage.getItem('lc_csrf') ?? '') || getCookieFromHeader(session, 'csrftoken')
  return { session, csrfToken }
}

async function lcGraphql(
  session: string,
  csrfToken: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const res = await lcFetch('/api/leetcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, csrfToken, query, variables }),
  })
  return res.json()
}

function isSolvedOnLcList(questionId: number): boolean {
  const sync = readLcListSync()
  return Boolean(sync?.solvedIds?.includes(questionId))
}

/**
 * Fetch most recent accepted submission for this grind language.
 * Returns '' when none found (caller should cache empty state).
 * Returns null when session missing / offline / network error (keep prior cache).
 */
export async function fetchGrindLcAcceptedCode(
  slug: string,
  lang: GrindLang,
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null

  const { session, csrfToken } = getLcCredentials()
  if (!session || !csrfToken) return null

  const want = grindLangToLc(lang)

  try {
    const r1 = await lcGraphql(
      session,
      csrfToken,
      `query($slug:String!,$offset:Int!,$limit:Int!){questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){submissions{id lang timestamp}}}`,
      { slug, offset: 0, limit: 40 },
    )
    const subs: { id: string; lang: string; timestamp: string }[] =
      r1?.data?.questionSubmissionList?.submissions ?? []

    const match = subs.find(s => {
      const l = s.lang.toLowerCase()
      if (want === 'python') return l === 'python3' || l === 'python'
      return l === 'cpp'
    })

    if (!match) return ''

    const r2 = await lcGraphql(
      session,
      csrfToken,
      `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
      { id: Number(match.id) },
    )
    const code = String(r2?.data?.submissionDetails?.code ?? '').trim()
    return code
  } catch {
    return null
  }
}

/**
 * Online: fetch + cache (refresh empty if LC list says solved).
 * Offline: use cache; uncached if never downloaded.
 */
export async function resolveGrindLcAcceptedCode(
  questionId: number,
  slug: string,
  lang: GrindLang,
): Promise<GrindLcAcceptedResolve> {
  const cached = readGrindLcAcceptedCache(questionId, lang)
  const solvedHint = isSolvedOnLcList(questionId)

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const { session, csrfToken } = getLcCredentials()
    if (!session || !csrfToken) {
      if (cached && !cached.empty) return { status: 'ready', code: cached.code }
      if (cached?.empty && !solvedHint) return { status: 'empty' }
      return { status: 'uncached' }
    }

    // Keep good cache; re-fetch empty when list sync says this problem is solved.
    if (cached && !cached.empty) return { status: 'ready', code: cached.code }

    const fetched = await fetchGrindLcAcceptedCode(slug, lang)
    if (fetched !== null) {
      writeGrindLcAcceptedCache(questionId, lang, fetched)
      if (fetched.trim()) return { status: 'ready', code: fetched }
      return { status: 'empty' }
    }
  }

  if (cached && !cached.empty) return { status: 'ready', code: cached.code }
  if (cached?.empty && !solvedHint) return { status: 'empty' }
  if (cached?.empty && solvedHint) return { status: 'uncached' }
  return { status: 'uncached' }
}

export function applyAcceptedResolveToCode(
  code: string,
  lang: GrindLang,
  resolved: GrindLcAcceptedResolve,
): string {
  if (resolved.status === 'skipped') return code
  if (resolved.status === 'ready') return upsertAcceptedSection(code, lang, resolved.code, 'ready')
  if (resolved.status === 'empty') return upsertAcceptedSection(code, lang, null, 'empty')
  return upsertAcceptedSection(code, lang, null, 'uncached')
}

type PrefetchQuestion = { id: number; slug: string }

let prefetchAbort: AbortController | null = null

/** Background-download accepted solutions for solved grind questions (current lang). */
export async function prefetchGrindLcAcceptedForOffline(
  questions: PrefetchQuestion[],
  lang: GrindLang,
  onProgress?: (p: GrindLcAcceptedPrefetchProgress) => void,
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine) return

  const { session, csrfToken } = getLcCredentials()
  if (!session || !csrfToken) {
    onProgress?.({ done: 0, total: 0, cached: 0, running: false })
    return
  }

  prefetchAbort?.abort()
  const ac = new AbortController()
  prefetchAbort = ac

  const sync = readLcListSync()
  const solvedSet = new Set(sync?.solvedIds ?? [])
  // Prefer known-solved from LeetCode list sync; if none synced yet, skip bulk fetch.
  const pool = solvedSet.size > 0
    ? questions.filter(q => solvedSet.has(q.id))
    : []

  if (pool.length === 0) {
    onProgress?.({ done: 0, total: 0, cached: 0, running: false })
    return
  }

  const todo = pool.filter(q => {
    const c = readGrindLcAcceptedCache(q.id, lang)
    // Skip ready caches; refresh empty when list says solved.
    if (c && !c.empty) return false
    if (c?.empty && solvedSet.size > 0 && !solvedSet.has(q.id)) return false
    if (c?.empty && solvedSet.has(q.id)) return true
    return !c
  })

  const already = pool.length - todo.length
  onProgress?.({
    done: already,
    total: pool.length,
    cached: already,
    running: todo.length > 0,
  })

  let done = already
  let cached = already

  for (const q of todo) {
    if (ac.signal.aborted || !navigator.onLine) break
    const fetched = await fetchGrindLcAcceptedCode(q.slug, lang)
    if (ac.signal.aborted) break
    if (fetched !== null) {
      writeGrindLcAcceptedCache(q.id, lang, fetched)
      if (fetched.trim()) cached++
    }
    done++
    onProgress?.({ done, total: pool.length, cached, running: true })
    await new Promise(r => setTimeout(r, 350))
  }

  onProgress?.({
    done: Math.min(done, pool.length),
    total: pool.length,
    cached,
    running: false,
  })
}

export function stopGrindLcAcceptedPrefetch(): void {
  prefetchAbort?.abort()
  prefetchAbort = null
}
