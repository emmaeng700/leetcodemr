import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const qid = toLeetCodeQuestionId(questionId)
    const slug = encodeURIComponent(String(titleSlug))
    const { res, text } = await fetchLeetCodeProblemPost(
      `${LC}/problems/${slug}/submit/`,
      {
        lang,
        question_id: qid,
        typed_code: code,
        test_mode: false,
        judge_type: 'large',
      },
      String(titleSlug),
      session,
      csrfToken,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `LeetCode returned HTML instead of JSON (HTTP ${res.status}). This is usually Cloudflare/WAF blocking server-side requests.\n\nFix: paste your full leetcode.com Cookie header (including cf_clearance/__cf_bm if present) into the session field, then retry. If it still fails, LeetCode may be blocking your deployment’s IP/TLS fingerprint and server-side submit/run will not work reliably.`
          : parsed.error
      return NextResponse.json({ error: hint, httpStatus: res.status }, { status: 502 })
    }
    const data = parsed.data as { error?: string; submission_id?: string | number }

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${res.status}` }, { status: res.status })
    }

    // Returns { submission_id: 123456 }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
