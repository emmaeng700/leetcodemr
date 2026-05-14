import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const USER_ID = 'emmanuel'

/** GET /api/ac-counts — accepted submission counts per question_id from Supabase */
export async function GET() {
  const { data, error } = await supabase
    .from('ac_submit_counts')
    .select('question_id, count')
    .eq('user_id', USER_ID)

  if (error) {
    return NextResponse.json({ byId: {} })
  }

  const byId: Record<number, number> = {}
  for (const row of data ?? []) {
    byId[row.question_id] = row.count
  }

  return NextResponse.json({ byId })
}
