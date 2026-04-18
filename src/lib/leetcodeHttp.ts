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

/** Browser-like headers + JSON POST to LeetCode problem pages (submit / run) */
export function leetCodeProblemApiHeaders(titleSlug: string, session: string, csrfToken: string): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  return {
    'Content-Type': 'application/json',
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    'X-CSRFToken': csrf,
    Referer: `${LC}/problems/${slug}/description/`,
    Origin: LC,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
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
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
}

export function leetCodeCheckHeaders(titleSlug: string, session: string, csrfToken: string): Record<string, string> {
  const sess = normalizeLcCookieValue(session)
  const csrf = normalizeLcCookieValue(csrfToken)
  const slug = encodeURIComponent(titleSlug)
  return {
    Cookie: `LEETCODE_SESSION=${sess}; csrftoken=${csrf}`,
    Referer: `${LC}/problems/${slug}/description/`,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': UA,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
}

export const lcFetchInit: Pick<RequestInit, 'cache'> = { cache: 'no-store' }
