import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { lcFetchInit, leetCodeCheckHeaders } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { checkId, titleSlug, session, csrfToken } = await req.json()

    const res = await fetch(`${LC}/submissions/detail/${checkId}/check/`, {
      headers: leetCodeCheckHeaders(String(titleSlug), session, csrfToken),
      ...lcFetchInit,
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
