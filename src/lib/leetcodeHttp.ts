import { isLeetCodeHtmlBody } from '@/lib/parseLeetCodeResponse'

const LC = 'https://leetcode.com'

/** LeetCode accepts numeric backend id; GraphQL often returns a string. */
export function toLeetCodeQuestionId(raw: unknown): number | string {
  const n = Number(raw)
  return Number.isFinite(n) ? n : String(raw ?? '')
}

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

export type LcPostStrategy = {
  referer: LcProblemReferer
  /** Match DevTools / python tools that send Sec-Fetch-* (helps some edge/WAF paths). */
  chromeHeaders?: boolean
  omitOrigin?: boolean
}

/** Browser-like headers for JSON POST to LeetCode problem APIs (submit / run). */
export function leetCodeProblemApiHeaders(
  titleSlug: string,
  session: string,
  csrfToken: string,
  opts?: LcPostStrategy,
): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    'X-CSRFToken': csrf,
    Referer: `${LC}/problems/${refPath}`,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
  }
  if (!opts?.omitOrigin) {
    base.Origin = LC
  }
  if (opts?.chromeHeaders) {
    base['Sec-Fetch-Dest'] = 'empty'
    base['Sec-Fetch-Mode'] = 'cors'
    base['Sec-Fetch-Site'] = 'same-origin'
    base['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
    base['sec-ch-ua-mobile'] = '?0'
    base['sec-ch-ua-platform'] = '"macOS"'
    base['Accept-Encoding'] = 'gzip, deflate, br, zstd'
  }
  return base
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
  opts?: { referer?: LcProblemReferer; chromeHeaders?: boolean },
): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  const base: Record<string, string> = {
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    Referer: `${LC}/problems/${refPath}`,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
  }
  if (opts?.chromeHeaders) {
    base['Sec-Fetch-Dest'] = 'empty'
    base['Sec-Fetch-Mode'] = 'cors'
    base['Sec-Fetch-Site'] = 'same-origin'
    base['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
    base['sec-ch-ua-mobile'] = '?0'
    base['sec-ch-ua-platform'] = '"macOS"'
    base['Accept-Encoding'] = 'gzip, deflate, br, zstd'
  }
  return base
}

export const lcFetchInit: Pick<RequestInit, 'cache'> = { cache: 'no-store' }

const RETRY_MS = 450

const POST_STRATEGIES: LcPostStrategy[] = [
  { referer: 'description' },
  { referer: 'problem-root' },
  { referer: 'description', chromeHeaders: true },
  { referer: 'description', omitOrigin: true },
]

const CHECK_STRATEGIES: Array<{ referer: LcProblemReferer; chromeHeaders?: boolean }> = [
  { referer: 'description' },
  { referer: 'problem-root' },
  { referer: 'description', chromeHeaders: true },
]

/**
 * POST to submit/interpret_solution. Retries with alternate Referer / headers if HTML
 * (login wall, transient edge) — matches patterns used by working CLI/python tools.
 */
export async function fetchLeetCodeProblemPost(
  fullUrl: string,
  jsonBody: object,
  titleSlug: string,
  session: string,
  csrf: string,
  opts?: { retryOnHtml?: boolean },
): Promise<{ res: Response; text: string }> {
  const retryOnHtml = opts?.retryOnHtml !== false
  let last: { res: Response; text: string } | null = null
  for (let i = 0; i < POST_STRATEGIES.length; i++) {
    const headers = leetCodeProblemApiHeaders(titleSlug, session, csrf, POST_STRATEGIES[i])
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonBody),
      ...lcFetchInit,
    })
    const text = await res.text()
    last = { res, text }
    // 429 = rate-limited: retrying immediately makes it worse, bail now.
    // 401 = definitely bad creds: no header strategy will fix it.
    // 403 = might be anti-bot / wrong Referer: try remaining strategies.
    if (res.status === 429 || res.status === 401) return last
    const isLast = i === POST_STRATEGIES.length - 1
    if (isLast) return last
    // Continue to next strategy if we got 403 or HTML (both indicate the
    // current header set was rejected — a different Referer/Sec-Fetch
    // fingerprint may get through).
    if (res.status !== 403 && !isLeetCodeHtmlBody(text)) return last
    await new Promise(r => setTimeout(r, RETRY_MS))
  }
  return last!
}

/** GET check/ poll — retry on HTML with alternate Referer / headers. */
export async function fetchLeetCodeCheckGet(
  fullUrl: string,
  titleSlug: string,
  session: string,
  csrf: string,
): Promise<{ res: Response; text: string }> {
  let last: { res: Response; text: string } | null = null
  for (let i = 0; i < CHECK_STRATEGIES.length; i++) {
    const s = CHECK_STRATEGIES[i]
    const headers = leetCodeCheckHeaders(titleSlug, session, csrf, s)
    const res = await fetch(fullUrl, { headers, ...lcFetchInit })
    const text = await res.text()
    last = { res, text }
    if (res.status === 429 || res.status === 401) return last
    const isLast = i === CHECK_STRATEGIES.length - 1
    if (isLast) return last
    if (res.status !== 403 && !isLeetCodeHtmlBody(text)) return last
    await new Promise(r => setTimeout(r, RETRY_MS))
  }
  return last!
}
