import { NextRequest, NextResponse } from 'next/server'

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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        lang,
        question_id: String(questionId),
        typed_code: code,
        data_input: testInput,
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${res.status}` }, { status: res.status })
    }

    // Returns { interpret_id: "...", test_case: "..." }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
