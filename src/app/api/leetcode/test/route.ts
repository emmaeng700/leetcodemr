import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const qid = toLeetCodeQuestionId(questionId)
    const slug = encodeURIComponent(String(titleSlug))
    const { res, text } = await fetchLeetCodeProblemPost(
      `${LC}/problems/${slug}/interpret_solution/`,
      {
        lang,
        question_id: qid,
        typed_code: code,
        data_input: testInput ?? '',
        test_mode: false,
      },
      String(titleSlug),
      session,
      csrfToken,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `LeetCode returned HTML instead of JSON (HTTP ${res.status}). Your session may be expired, blocked, or rate-limited. Refresh LEETCODE_SESSION + csrftoken and try again.`
          : parsed.error
      return NextResponse.json({ error: hint, httpStatus: res.status }, { status: 502 })
    }
    const data = parsed.data as { error?: string; interpret_id?: string }

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${res.status}` }, { status: res.status })
    }

    // Returns { interpret_id: "...", test_case: "..." }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
