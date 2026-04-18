import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const slug = encodeURIComponent(String(titleSlug))
    const { res, text } = await fetchLeetCodeProblemPost(
      `${LC}/problems/${slug}/interpret_solution/`,
      {
        lang,
        question_id: String(questionId),
        typed_code: code,
        data_input: testInput,
      },
      String(titleSlug),
      session,
      csrfToken,
    )

    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Run failed.' }, { status: 502 })
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
