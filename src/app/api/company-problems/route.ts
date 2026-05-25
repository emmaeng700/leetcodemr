import { NextResponse } from 'next/server'

/** Proxy for leetbot.org company problems — avoids CORS restrictions. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const timeframe = searchParams.get('timeframe') ?? 'all'

  if (!company) {
    return NextResponse.json({ error: 'Missing company param' }, { status: 400 })
  }

  try {
    const url = `https://leetbot.org/api/companies/${encodeURIComponent(company)}/timeframes/${encodeURIComponent(timeframe)}/problems`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch problems' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not reach leetbot.org' }, { status: 502 })
  }
}
