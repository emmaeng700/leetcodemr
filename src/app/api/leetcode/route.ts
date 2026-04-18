import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Pull session creds if client sends them (needed for premium questions)
    const { session, csrfToken, ...graphqlBody } = body

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://leetcode.com/problems/',
      'Origin': 'https://leetcode.com',
      'x-requested-with': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
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

    const text = await res.text()
    const parsed = parseLeetCodeJsonText(text, res.status)
    if (!parsed.ok) {
      return NextResponse.json({ errors: [{ message: parsed.error }] }, { status: 502 })
    }
    return NextResponse.json(parsed.data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
