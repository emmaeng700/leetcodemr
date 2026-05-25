import { NextResponse } from 'next/server'
import { resetMasteryRuns } from '@/lib/db'

/** One-shot cleanup: clears all mastery_run_events for the user. */
export async function POST() {
  const result = await resetMasteryRuns()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
