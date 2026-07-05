import { NextResponse } from 'next/server'
import {
  extractLeetCodeSessionValue,
  getCookieFromHeader,
  lcFetchInit,
  looksLikeLcCookieJar,
  parseSetCookieHeaderValue,
} from '@/lib/leetcodeHttp'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Fetch csrftoken from leetcode.com using a saved LEETCODE_SESSION. */
export async function POST(req: Request) {
  let session = ''
  try {
    const body = await req.json()
    session = String(body.session ?? body.lc_session ?? '').trim()
  } catch {
    return NextResponse.json({ csrf: '' })
  }

  if (!session) return NextResponse.json({ csrf: '' })

  const fromJar = looksLikeLcCookieJar(session) ? getCookieFromHeader(session, 'csrftoken') : ''
  if (fromJar) return NextResponse.json({ csrf: fromJar })

  const sessionValue = extractLeetCodeSessionValue(session)
  if (!sessionValue) return NextResponse.json({ csrf: '' })

  try {
    const res = await fetch('https://leetcode.com/', {
      headers: {
        Cookie: `LEETCODE_SESSION=${sessionValue}`,
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      ...lcFetchInit,
    })

    const setCookies = res.headers.getSetCookie?.() ?? []
    for (const h of setCookies) {
      const csrf = parseSetCookieHeaderValue(h, 'csrftoken')
      if (csrf) return NextResponse.json({ csrf })
    }
  } catch {
    return NextResponse.json({ csrf: '' })
  }

  return NextResponse.json({ csrf: '' })
}
