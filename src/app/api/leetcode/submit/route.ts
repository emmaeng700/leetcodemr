import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { lcFetchInit, leetCodeProblemApiHeaders } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const slug = encodeURIComponent(String(titleSlug))
    const res = await fetch(`${LC}/problems/${slug}/submit/`, {
      method: 'POST',
      headers: leetCodeProblemApiHeaders(String(titleSlug), session, csrfToken),
      body: JSON.stringify({
        lang,
        question_id: String(questionId),
        typed_code: code,
      }),
      ...lcFetchInit,
    })

    const text = await res.text()
    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 502 })
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
