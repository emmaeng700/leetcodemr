import { NextResponse } from 'next/server'

/** Proxy for leetbot.org company list — avoids CORS restrictions. */
export async function GET() {
  try {
    const res = await fetch('https://leetbot.org/api/companies', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not reach leetbot.org' }, { status: 502 })
  }
}
