import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const USER_ID = 'emmanuel'

/** GET /api/best-solutions — return all saved best solutions for the user */
export async function GET() {
  const { data, error } = await supabase
    .from('best_solutions')
    .select('question_id, language, code, updated_at')
    .eq('user_id', USER_ID)
    .order('question_id', { ascending: true })

  if (error) {
    // Table not yet created — return empty list instead of crashing the page
    if (error.message?.toLowerCase().includes('does not exist') ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('could not find')) {
      return NextResponse.json({ solutions: [], tableReady: false })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ solutions: data ?? [], tableReady: true })
}

/** POST /api/best-solutions — upsert a single best solution */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { question_id, language, code } = body as {
    question_id?: number
    language?: string
    code?: string
  }

  if (!question_id || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json(
      { error: 'question_id and code are required' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('best_solutions')
    .upsert(
      {
        user_id: USER_ID,
        question_id,
        language: language ?? 'python3',
        code: code.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_id' }
    )

  if (error) {
    if (error.message?.toLowerCase().includes('does not exist') ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('could not find')) {
      return NextResponse.json(
        { error: 'Table not ready — run supabase/create_best_solutions.sql in your Supabase dashboard' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
