import { NextRequest, NextResponse } from 'next/server'

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Pull session creds if client sends them (needed for premium questions)
    const { session, csrfToken, ...graphqlBody } = body

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }

    if (session && csrfToken) {
      headers['Cookie'] = `LEETCODE_SESSION=${session}; csrftoken=${csrfToken}`
      headers['X-CSRFToken'] = csrfToken
    }

    const res = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers,
      body: JSON.stringify(graphqlBody),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `LeetCode returned ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
