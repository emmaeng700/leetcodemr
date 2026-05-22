import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile, saveUserProfile } from '@/lib/db'

export async function GET() {
  const profile = await getUserProfile()
  return NextResponse.json({ profile: profile ?? {} })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { emailEnabled, emailTimes, timezone, reviewStartDays, revisionCap, repsPerQ } = body

  const ok = await saveUserProfile({
    ...(emailEnabled    !== undefined && { emailEnabled }),
    ...(emailTimes      !== undefined && { emailTimes }),
    ...(timezone        !== undefined && { timezone }),
    ...(reviewStartDays !== undefined && { reviewStartDays }),
    ...(revisionCap     !== undefined && { revisionCap }),
    ...(repsPerQ        !== undefined && { repsPerQ }),
  })

  return NextResponse.json({ ok })
}
