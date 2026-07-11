/**
 * Grind editor: third learning section = latest accepted LeetCode submission.
 * Fetched while online, cached in localStorage for offline Grind.
 */

import type { GrindLang } from '@/lib/grindStorage'
import { getCookieFromHeader } from '@/lib/leetcodeHttp'
import { lcFetch } from '@/lib/leetcodeLocalConnector'

export const ACCEPTED_MARKER_PY = '# -- Your LeetCode Accepted --'
export const ACCEPTED_MARKER_CPP = '// -- Your LeetCode Accepted --'

export type GrindLcAcceptedCache = {
  code: string
  fetchedAt: string
  empty: boolean
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

function commentLine(lang: GrindLang, text = ''): string {
  if (lang === 'python3') return text ? `# ${text}` : '#'
  return text ? `// ${text}` : '//'
}

/** Format accepted solution (or empty guidance) as a comment section. */
export function formatAcceptedSection(lang: GrindLang, acceptedCode: string | null): string {
  const marker = acceptedMarker(lang)

  if (!acceptedCode?.trim()) {
    return [
      marker,
      commentLine(lang, 'Latest accepted submission from leetcode.com (cached for offline).'),
      commentLine(lang, ''),
      commentLine(lang, 'No accepted solution found for this language yet.'),
      commentLine(lang, 'Go to LeetCode, get Accepted, then reopen Grind while online'),
      commentLine(lang, 'so it can cache this section for offline use.'),
    ].join('\n')
  }

  const body = acceptedCode
    .replace(/\r\n/g, '\n')
    .trimEnd()
    .split('\n')
    .map(line => commentLine(lang, line))

  return [
    marker,
    commentLine(lang, 'Latest accepted submission from leetcode.com (cached for offline).'),
    commentLine(lang, ''),
    ...body,
  ].join('\n')
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

/**
 * Replace or append the accepted section. Does not touch solution / interview body.
 */
export function upsertAcceptedSection(
  code: string,
  lang: GrindLang,
  acceptedCode: string | null,
): string {
  const section = formatAcceptedSection(lang, acceptedCode)
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
 * Online: fetch + cache. Offline / no session: use cache.
 * Always returns a string|null for upsert (null = show empty guidance).
 */
export async function resolveGrindLcAcceptedCode(
  questionId: number,
  slug: string,
  lang: GrindLang,
): Promise<string | null> {
  const cached = readGrindLcAcceptedCache(questionId, lang)

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const fetched = await fetchGrindLcAcceptedCode(slug, lang)
    if (fetched !== null) {
      writeGrindLcAcceptedCache(questionId, lang, fetched)
      return fetched.trim() ? fetched : null
    }
  }

  if (cached) return cached.empty ? null : cached.code
  return null
}
