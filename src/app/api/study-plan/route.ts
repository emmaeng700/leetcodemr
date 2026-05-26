import { NextRequest, NextResponse } from 'next/server'
import { getStudyPlan, saveStudyPlan } from '@/lib/db'

export async function GET() {
  const plan = await getStudyPlan()
  return NextResponse.json({ plan: plan ?? null })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const plan = await getStudyPlan()
  if (!plan) return NextResponse.json({ ok: false, error: 'No plan set' }, { status: 404 })

  const updated: typeof plan = { ...plan }
  if (typeof body.per_day === 'number') {
    updated.per_day = Math.max(1, Math.min(20, Math.round(body.per_day)))
  }

  const ok = await saveStudyPlan(updated as Parameters<typeof saveStudyPlan>[0])
  return NextResponse.json({ ok })
}
