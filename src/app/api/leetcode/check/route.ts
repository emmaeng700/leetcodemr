import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { checkId, titleSlug, session, csrfToken } = await req.json()

    const res = await fetch(`${LC}/submissions/detail/${checkId}/check/`, {
      headers: {
        'Cookie': `LEETCODE_SESSION=${session}; csrftoken=${csrfToken}`,
        'Referer': `${LC}/problems/${titleSlug}/`,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-requested-with': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    })

    const text = await res.text()
    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, state: 'ERROR', status_msg: parsed.error },
        { status: 502 },
      )
    }
    return NextResponse.json(parsed.data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
