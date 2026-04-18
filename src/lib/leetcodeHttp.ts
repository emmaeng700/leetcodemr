import { isLeetCodeHtmlBody } from '@/lib/parseLeetCodeResponse'

const LC = 'https://leetcode.com'

/** User pasted "LEETCODE_SESSION=..." into the value field, or added quotes/newlines */
export function normalizeLcCookieValue(raw: unknown): string {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  const stripName = (name: string) => {
    const re = new RegExp(`^${name}\\s*=\\s*(.+)$`, 'i')
    const m = s.match(re)
    if (m) s = m[1].trim()
  }
  stripName('LEETCODE_SESSION')
  stripName('csrftoken')
  s = s.replace(/^["']|["']$/g, '').trim()
  return s
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export type LcProblemReferer = 'description' | 'problem-root'

/** Browser-like headers for JSON POST to LeetCode problem APIs (submit / run). No Sec-Fetch / sec-ch-* — those often mismatch server-side fetches and confuse edge checks. */
export function leetCodeProblemApiHeaders(
  titleSlug: string,
  session: string,
  csrfToken: string,
  opts?: { referer?: LcProblemReferer },
): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  return {
    'Content-Type': 'application/json',
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    'X-CSRFToken': csrf,
    Referer: `${LC}/problems/${refPath}`,
    Origin: LC,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
  }
}

export function leetCodeGraphqlHeaders(session: string, csrfToken: string): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  return {
    'Content-Type': 'application/json',
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    'X-CSRFToken': csrf,
    Referer: `${LC}/problems/`,
    Origin: LC,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
  }
}

export function leetCodeCheckHeaders(
  titleSlug: string,
  session: string,
  csrfToken: string,
  opts?: { referer?: LcProblemReferer },
): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  return {
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    Referer: `${LC}/problems/${refPath}`,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
  }
}

export const lcFetchInit: Pick<RequestInit, 'cache'> = { cache: 'no-store' }

const RETRY_MS = 400

/**
 * POST to submit/interpret_solution. If LeetCode returns an HTML page (often transient),
 * retry once with a different Referer — same browser typically uses /description/.
 */
export async function fetchLeetCodeProblemPost(
  fullUrl: string,
  jsonBody: object,
  titleSlug: string,
  session: string,
  csrf: string,
): Promise<{ res: Response; text: string }> {
  const referers: LcProblemReferer[] = ['description', 'problem-root']
  for (let i = 0; i < referers.length; i++) {
    const headers = leetCodeProblemApiHeaders(titleSlug, session, csrf, { referer: referers[i] })
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonBody),
      ...lcFetchInit,
    })
    const text = await res.text()
    const isLast = i === referers.length - 1
    if (isLast || !isLeetCodeHtmlBody(text)) {
      return { res, text }
    }
    await new Promise(r => setTimeout(r, RETRY_MS))
  }
  throw new Error('fetchLeetCodeProblemPost: unreachable')
}

/** GET check/ poll — retry once on HTML body with alternate Referer. */
export async function fetchLeetCodeCheckGet(
  fullUrl: string,
  titleSlug: string,
  session: string,
  csrf: string,
): Promise<{ res: Response; text: string }> {
  const referers: LcProblemReferer[] = ['description', 'problem-root']
  for (let i = 0; i < referers.length; i++) {
    const headers = leetCodeCheckHeaders(titleSlug, session, csrf, { referer: referers[i] })
    const res = await fetch(fullUrl, { headers, ...lcFetchInit })
    const text = await res.text()
    const isLast = i === referers.length - 1
    if (isLast || !isLeetCodeHtmlBody(text)) {
      return { res, text }
    }
    await new Promise(r => setTimeout(r, RETRY_MS))
  }
  throw new Error('fetchLeetCodeCheckGet: unreachable')
}
