import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCookieFromHeader, normalizeLcCookieValue } from '@/lib/leetcodeHttp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const USER_ID = 'emmanuel'

export async function GET() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('lc_session, lc_csrf')
    .eq('user_id', USER_ID)
    .single()

  if (error || !data) {
    return NextResponse.json({ lc_session: '', lc_csrf: '' })
  }

  return NextResponse.json({ lc_session: data.lc_session ?? '', lc_csrf: data.lc_csrf ?? '' })
}

export async function POST(req: Request) {
  const body = await req.json()
  const rawSession = String(body.lc_session ?? '').trim()
  const rawCsrf = String(body.lc_csrf ?? '').trim()

  // Back-compat: allow either value-only tokens OR a full Cookie header / cookie jar.
  const looksLikeCookieJar = /LEETCODE_SESSION\s*=/.test(rawSession) && rawSession.includes(';')

  const lc_session = looksLikeCookieJar
    ? rawSession.replace(/^cookie:\s*/i, '').trim()
    : normalizeLcCookieValue(rawSession)

  // If user pasted the full cookie jar, try extracting csrftoken from it so the rest
  // of the app continues to work with the separate csrf field.
  const csrfFromJar = looksLikeCookieJar ? getCookieFromHeader(lc_session, 'csrftoken') : ''
  const lc_csrf = normalizeLcCookieValue(rawCsrf) || normalizeLcCookieValue(csrfFromJar)

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, lc_session, lc_csrf }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
