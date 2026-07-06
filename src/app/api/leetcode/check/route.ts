import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeCheckGet, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { checkId, titleSlug, session, csrfToken } = await req.json()

    const { session: sess, csrf } = await resolveLcSessionCredentials(session, csrfToken, {
      titleSlug: String(titleSlug),
    })
    if (!sess || !csrf) {
      return NextResponse.json({
        error: 'Missing csrftoken. Paste csrftoken from DevTools (Application > Cookies on leetcode.com) on the same line as LEETCODE_SESSION.',
        state: 'ERROR',
        status_msg: 'Run failed.',
      }, { status: 401 })
    }

    const { res, text } = await fetchLeetCodeCheckGet(
      `${LC}/submissions/detail/${checkId}/check/`,
      String(titleSlug),
      sess,
      csrf,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `LeetCode rejected the request (HTTP ${res.status}). Check your session and csrftoken, then retry.`
          : parsed.error
      return NextResponse.json(
        { error: hint, httpStatus: res.status, state: 'ERROR', status_msg: 'Run failed.' },
        { status: 502 },
      )
    }
    return NextResponse.json(parsed.data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
