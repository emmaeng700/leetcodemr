import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeCheckGet, resolveLcSessionCredentials } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { checkId, titleSlug, session, csrfToken } = await req.json()

    const { session: sess, csrf } = await resolveLcSessionCredentials(session, csrfToken)
    if (!sess || !csrf) {
      return NextResponse.json({
        error: 'Missing csrftoken. Also paste csrftoken from DevTools (Application > Cookies on leetcode.com), or use the full Cookie header with cf_clearance.',
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
          ? `LeetCode returned HTML instead of JSON (HTTP ${res.status}). Paste the full Cookie header from leetcode.com (include cf_clearance) into Session and retry.`
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
