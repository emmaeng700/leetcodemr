import { NextRequest, NextResponse } from 'next/server'

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

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
