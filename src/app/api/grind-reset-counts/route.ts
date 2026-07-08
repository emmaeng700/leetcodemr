import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const USER_ID = 'emmanuel'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function parseCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k)
    const count = Number(v)
    if (Number.isFinite(id) && id > 0 && Number.isFinite(count) && count > 0) {
      out[String(id)] = count
    }
  }
  return out
}

async function fetchRemoteCounts(): Promise<Record<string, number>> {
  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('grind_reset_counts')
    .select('question_id, count')
    .eq('user_id', USER_ID)
  if (error) return {}
  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = Number((row as { question_id: number }).question_id)
    const count = Number((row as { count: number }).count ?? 0)
    if (Number.isFinite(id) && id > 0 && count > 0) out[String(id)] = count
  }
  return out
}

export async function GET() {
  try {
    const counts = await fetchRemoteCounts()
    return NextResponse.json({ counts })
  } catch {
    return NextResponse.json({ counts: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const local = parseCounts(body?.counts)
    const supabase = getAdmin()

    for (const [qid, localCount] of Object.entries(local)) {
      const questionId = Number(qid)
      const { data: existing, error: readErr } = await supabase
        .from('grind_reset_counts')
        .select('count')
        .eq('user_id', USER_ID)
        .eq('question_id', questionId)
        .maybeSingle()
      if (readErr) continue
      const remoteCount = Number((existing as { count?: number } | null)?.count ?? 0)
      const finalCount = Math.max(localCount, remoteCount)
      await supabase.from('grind_reset_counts').upsert(
        {
          user_id: USER_ID,
          question_id: questionId,
          count: finalCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,question_id' },
      )
    }

    const remote = await fetchRemoteCounts()
    const merged: Record<string, number> = { ...local }
    for (const [k, v] of Object.entries(remote)) {
      merged[k] = Math.max(merged[k] ?? 0, v)
    }
    return NextResponse.json({ counts: merged })
  } catch {
    return NextResponse.json({ counts: {} }, { status: 500 })
  }
}
