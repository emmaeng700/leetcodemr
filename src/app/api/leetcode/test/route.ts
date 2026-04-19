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
    const url = `${LC}/problems/${slug}/interpret_solution/`
    const input = testInput ?? ''

    // LeetCode is inconsistent about `interpret_solution` for some accounts/problems:
    // - some require test_mode=true, others still accept false
    // - some reject non-empty data_input with a 403 HTML response
    // Try a few payload variants before giving up.
    const payloads = [
      { lang, question_id: qid, typed_code: code, data_input: input, test_mode: true },
      { lang, question_id: qid, typed_code: code, data_input: input, test_mode: false },
      { lang, question_id: qid, typed_code: code, data_input: '',    test_mode: true },
      { lang, question_id: qid, typed_code: code, data_input: '',    test_mode: false },
    ]

    let lastRes: Response | null = null
    let lastText = ''
    for (const body of payloads) {
      const { res, text } = await fetchLeetCodeProblemPost(
        url,
        body,
        String(titleSlug),
        session,
        csrfToken,
      )
      lastRes = res
      lastText = text

      const parsed = parseLeetCodeJsonText(text, res.status)
      if (!parsed.ok) continue
      const data = parsed.data as { error?: string; interpret_id?: string }
      if (!res.ok || data.error) continue
      return NextResponse.json(data)
    }

    const parsed = parseLeetCodeJsonText(lastText, lastRes?.status ?? 0)
    if (!parsed.ok) {
      const hint =
        parsed.error === 'non_json_html'
          ? `LeetCode returned HTML instead of JSON (HTTP ${lastRes?.status}). Your session may be expired, blocked, or rate-limited. Refresh LEETCODE_SESSION + csrftoken and try again.`
          : parsed.error
      return NextResponse.json({ error: hint, httpStatus: lastRes?.status }, { status: 502 })
    }
    const data = parsed.data as { error?: string }

    if (!lastRes?.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${lastRes?.status}` }, { status: lastRes?.status ?? 502 })
    }

    return NextResponse.json({ error: 'Run failed.' }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
