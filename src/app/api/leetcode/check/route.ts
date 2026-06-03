import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeCheckGet } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { checkId, titleSlug, session, csrfToken } = await req.json()

    const { res, text } = await fetchLeetCodeCheckGet(
      `${LC}/submissions/detail/${checkId}/check/`,
      String(titleSlug),
      session,
      csrfToken,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `LeetCode returned HTML instead of JSON (HTTP ${res.status}). This is a network/session block (Cloudflare/WAF), not a Python syntax error — parentheses and \`and\`/\`or\` in your code are fine.\n\nFix: paste your full leetcode.com Cookie header (including cf_clearance/__cf_bm if present) into the session field, then retry. For reliable Run/Submit on Vercel, use the browser extension or \`npm run lc:connector\` locally.`
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
