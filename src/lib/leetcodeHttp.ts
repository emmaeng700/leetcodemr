import { isLeetCodeHtmlBody } from '@/lib/parseLeetCodeResponse'

const LC = 'https://leetcode.com'

/** LeetCode accepts numeric backend id; GraphQL often returns a string. */
export function toLeetCodeQuestionId(raw: unknown): number | string {
  const n = Number(raw)
  return Number.isFinite(n) ? n : String(raw ?? '')
}

const SET_COOKIE_ATTRS = new Set(['domain', 'path', 'expires', 'max-age', 'samesite'])

/** Cookie attribute from DevTools Application tab (Domain=, HttpOnly, Secure, etc.). */
export function isSetCookieAttribute(part: string): boolean {
  const t = part.trim()
  if (!t) return false
  if (!t.includes('=')) return /^(httponly|secure)$/i.test(t)
  return SET_COOKIE_ATTRS.has(t.split('=')[0].trim().toLowerCase())
}

/** Set-Cookie line copied from Application -> Cookies, not a request Cookie header. */
export function isSetCookieLine(raw: unknown): boolean {
  const s = String(raw ?? '').trim().replace(/^cookie:\s*/i, '')
  if (!/LEETCODE_SESSION\s*=/.test(s) || !s.includes(';')) return false
  const rest = s.split(';').slice(1).map(p => p.trim()).filter(Boolean)
  return rest.length > 0 && rest.every(isSetCookieAttribute)
}

/** Bare LEETCODE_SESSION JWT/value from any supported paste format. */
export function extractLeetCodeSessionValue(raw: unknown): string {
  let s = String(raw ?? '').trim().replace(/^cookie:\s*/i, '')
  if (!s) return ''

  const prefixed = s.match(/^LEETCODE_SESSION\s*=\s*([\s\S]+)$/i)
  if (prefixed) {
    const afterEq = prefixed[1].trim()
    const semi = afterEq.indexOf(';')
    if (semi === -1) return afterEq.replace(/^["']|["']$/g, '').trim()
    const value = afterEq.slice(0, semi).trim().replace(/^["']|["']$/g, '')
    const rest = afterEq.slice(semi + 1).split(';').map(p => p.trim()).filter(Boolean)
    if (rest.length === 0 || rest.every(isSetCookieAttribute)) return value
    return value
  }

  s = s.replace(/^["']|["']$/g, '').trim()
  return s
}

/** User pasted "LEETCODE_SESSION=..." value only, or added quotes/newlines — not a full cookie jar. */
export function normalizeLcCookieValue(raw: unknown): string {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  if (looksLikeLcCookieJar(s)) return s.replace(/^cookie:\s*/i, '').trim()
  if (isSetCookieLine(s) || /^LEETCODE_SESSION\s*=/i.test(s)) {
    return extractLeetCodeSessionValue(s)
  }
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

/** Request Cookie header with multiple cookies (csrftoken, cf_clearance, etc.). */
export function looksLikeLcCookieJar(raw: unknown): boolean {
  const s = String(raw ?? '').trim().replace(/^cookie:\s*/i, '')
  if (!/LEETCODE_SESSION\s*=/.test(s) || !s.includes(';')) return false
  if (isSetCookieLine(s)) return false
  return true
}

/** Fix sessions corrupted by an older bug that stripped the LEETCODE_SESSION= prefix. */
export function repairCorruptedCookieJar(raw: unknown): string {
  const s = String(raw ?? '').trim().replace(/^cookie:\s*/i, '').trim()
  if (!s || looksLikeLcCookieJar(s)) return s
  if (!s.includes(';')) return s
  const firstSemi = s.indexOf(';')
  const firstPart = s.slice(0, firstSemi).trim()
  const rest = s.slice(firstSemi + 1).trim()
  if (firstPart.includes('=')) return s
  if (/csrftoken=|cf_clearance=|__cf_bm=/i.test(rest)) {
    return `LEETCODE_SESSION=${firstPart}; ${rest}`
  }
  return s
}

/** Read session from localStorage/Supabase without corrupting a full Cookie header. */
export function parseStoredLcSession(rawSession: unknown, rawCsrf?: unknown): { session: string; csrf: string } {
  const session = repairCorruptedCookieJar(rawSession)
  if (!session) return { session: '', csrf: '' }
  if (looksLikeLcCookieJar(session)) {
    const jar = session.replace(/^cookie:\s*/i, '').trim()
    const csrf =
      normalizeLcCookieValue(rawCsrf) || getCookieFromHeader(jar, 'csrftoken')
    return { session: jar, csrf }
  }
  const csrf = normalizeLcCookieValue(rawCsrf) || ''
  return { session: extractLeetCodeSessionValue(session), csrf }
}

export function getCookieFromHeader(cookieHeaderRaw: string, name: string): string {
  const cookieHeader = String(cookieHeaderRaw ?? '').trim()
  if (!cookieHeader) return ''
  const normalized = cookieHeader.replace(/^cookie:\s*/i, '')
  const parts = normalized.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    if (k.trim() === name) return rest.join('=').trim()
  }
  return ''
}

/** True when a pasted cookie jar includes Cloudflare clearance (needed for Vercel Run/Submit). */
export function hasCfClearance(cookieHeaderRaw: string): boolean {
  return !!getCookieFromHeader(cookieHeaderRaw, 'cf_clearance')
}

/**
 * Normalize user input into a Cookie header string.
 * Accepts either:
 * - value-only LEETCODE_SESSION (and we’ll build the Cookie header)
 * - full cookie jar / "Cookie: ..." string containing LEETCODE_SESSION=...
 */
export function normalizeLcCookieHeader(rawSessionOrCookieJar: unknown, csrfToken: unknown): { cookie: string; csrf: string } {
  const raw = String(rawSessionOrCookieJar ?? '').trim()
  const rawCsrf = String(csrfToken ?? '').trim()

  if (looksLikeLcCookieJar(raw)) {
    const cookie = raw.replace(/^cookie:\s*/i, '').trim()
    const csrfFromJar = getCookieFromHeader(cookie, 'csrftoken')
    const csrf = normalizeLcCookieValue(rawCsrf) || normalizeLcCookieValue(csrfFromJar)
    return { cookie, csrf }
  }

  const sess = extractLeetCodeSessionValue(raw) || normalizeLcCookieValue(raw)
  const csrf = normalizeLcCookieValue(rawCsrf)
  return { cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`, csrf }
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
  const { cookie, csrf } = normalizeLcCookieHeader(session, csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: cookie,
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
  const { cookie, csrf } = normalizeLcCookieHeader(session, csrfToken)
  return {
    'Content-Type': 'application/json',
    Cookie: cookie,
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
  const { cookie } = normalizeLcCookieHeader(session, csrfToken)
  const slug = encodeURIComponent(titleSlug)
  const refPath =
    (opts?.referer ?? 'description') === 'description'
      ? `${slug}/description/`
      : `${slug}/`
  const base: Record<string, string> = {
    Cookie: cookie,
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
