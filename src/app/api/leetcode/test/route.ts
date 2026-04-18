import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const res = await fetch(`${LC}/problems/${titleSlug}/interpret_solution/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `LEETCODE_SESSION=${session}; csrftoken=${csrfToken}`,
        'X-CSRFToken': csrfToken,
        'Referer': `${LC}/problems/${titleSlug}/`,
        'Origin': LC,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-requested-with': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        lang,
        question_id: String(questionId),
        typed_code: code,
        data_input: testInput,
      }),
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
