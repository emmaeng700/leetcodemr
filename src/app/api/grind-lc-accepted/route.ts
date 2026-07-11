import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const USER_ID = 'emmanuel'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

type Item = {
  question_id: number
  lang: string
  code: string
  empty: boolean
  fetched_at: string
}

function normalizeLang(raw: unknown): 'python3' | 'cpp' | null {
  const s = String(raw ?? '')
  if (s === 'python3' || s === 'python') return 'python3'
  if (s === 'cpp') return 'cpp'
  return null
}

function parseItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const questionId = Number(o.question_id ?? o.questionId)
  const lang = normalizeLang(o.lang)
  if (!Number.isFinite(questionId) || questionId <= 0 || !lang) return null
  const code = String(o.code ?? '')
  const empty = o.empty === true || !code.trim()
  const fetchedAt = String(o.fetched_at ?? o.fetchedAt ?? new Date().toISOString())
  return {
    question_id: questionId,
    lang,
    code: empty ? '' : code,
    empty,
    fetched_at: fetchedAt,
  }
}

async function fetchAll(): Promise<Item[]> {
  const { data, error } = await supabase()
    .from('grind_lc_accepted')
    .select('question_id, lang, code, empty, fetched_at')
    .eq('user_id', USER_ID)

  if (error) {
    const missing =
      error.message?.toLowerCase().includes('does not exist') ||
      error.message?.toLowerCase().includes('schema cache')
    if (missing) return []
    return []
  }

  const out: Item[] = []
  for (const row of data ?? []) {
    const item = parseItem(row)
    if (item) out.push(item)
  }
  return out
}

export async function GET() {
  try {
    const items = await fetchAll()
    return NextResponse.json({ items, tableReady: true })
  } catch {
    return NextResponse.json({ items: [], tableReady: false })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawItems = Array.isArray(body?.items)
      ? body.items
      : body?.item
        ? [body.item]
        : []

    const items = rawItems.map(parseItem).filter((x: Item | null): x is Item => x != null)
    if (items.length === 0) {
      const all = await fetchAll()
      return NextResponse.json({ items: all })
    }

    const client = supabase()
    for (const item of items) {
      await client.from('grind_lc_accepted').upsert(
        {
          user_id: USER_ID,
          question_id: item.question_id,
          lang: item.lang,
          code: item.code,
          empty: item.empty,
          fetched_at: item.fetched_at,
        },
        { onConflict: 'user_id,question_id,lang' },
      )
    }

    const all = await fetchAll()
    return NextResponse.json({ items: all })
  } catch (e) {
    return NextResponse.json(
      { items: [], error: e instanceof Error ? e.message : 'failed' },
      { status: 500 },
    )
  }
}
