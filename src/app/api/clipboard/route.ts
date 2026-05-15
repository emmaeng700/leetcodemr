import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const USER_ID = 'emmanuel'

export async function GET() {
  const { data, error } = await supabase
    .from('clipboard_items')
    .select('id, label, content, is_token, created_at')
    .eq('user_id', USER_ID)
    .order('is_token', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    const missing = error.message?.toLowerCase().includes('does not exist') ||
                    error.message?.toLowerCase().includes('schema cache') ||
                    error.message?.toLowerCase().includes('could not find')
    if (missing) return NextResponse.json({ items: [], tableReady: false })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [], tableReady: true })
}

export async function POST(req: Request) {
  const { label, content, is_token } = await req.json().catch(() => ({}))
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  // Reject duplicate tokens — same content already saved as a token
  if (is_token === true) {
    const { data: existing } = await supabase
      .from('clipboard_items')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('is_token', true)
      .eq('content', content.trim())
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'duplicate', message: 'This token is already saved' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('clipboard_items')
    .insert({ user_id: USER_ID, label: (label ?? '').trim(), content: content.trim(), is_token: is_token === true })
    .select('id, label, content, is_token, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('clipboard_items')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
