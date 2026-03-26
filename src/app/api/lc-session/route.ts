import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  const { lc_session, lc_csrf } = await req.json()

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, lc_session, lc_csrf }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
