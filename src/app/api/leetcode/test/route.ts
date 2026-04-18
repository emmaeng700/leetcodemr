import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { lcFetchInit, leetCodeProblemApiHeaders } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const slug = encodeURIComponent(String(titleSlug))
    const res = await fetch(`${LC}/problems/${slug}/interpret_solution/`, {
      method: 'POST',
      headers: leetCodeProblemApiHeaders(String(titleSlug), session, csrfToken),
      body: JSON.stringify({
        lang,
        question_id: String(questionId),
        typed_code: code,
        data_input: testInput,
      }),
      ...lcFetchInit,
    })

    const text = await res.text()
    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 502 })
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
