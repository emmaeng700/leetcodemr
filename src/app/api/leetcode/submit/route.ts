import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, resolveLcSessionCredentials, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titleSlug, questionId, lang, code, session, csrfToken } = body

    const { session: sess, csrf } = await resolveLcSessionCredentials(session, csrfToken)
    if (!sess || !csrf) {
      return NextResponse.json({
        error: 'Missing csrftoken. Also paste csrftoken from DevTools (Application > Cookies on leetcode.com), or use the full Cookie header with cf_clearance.',
      }, { status: 401 })
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
      sess,
      csrf,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `Cloudflare blocked the request (HTTP ${res.status}). Paste the full Cookie header from leetcode.com (include cf_clearance) into Session and retry.`
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
