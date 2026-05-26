import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const USER_ID = 'emmanuel'
const APP_URL = 'https://leetcodemr.vercel.app'
const COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 hours — prevents double-fires across devices

export async function POST() {
  const to = process.env.NOTIFICATION_EMAIL ? [process.env.NOTIFICATION_EMAIL] : []
  if (to.length === 0) {
    return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL env var' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  )

  // ── Server-side cooldown (backs up the client localStorage guard) ────────────
  const { data: planMeta } = await supabase
    .from('study_plan')
    .select('last_slacking_notified_at')
    .eq('user_id', USER_ID)
    .maybeSingle()

  if (planMeta?.last_slacking_notified_at) {
    const msSinceLast = Date.now() - new Date(planMeta.last_slacking_notified_at as string).getTime()
    if (msSinceLast < COOLDOWN_MS) {
      return NextResponse.json({ skipped: 'Cooldown active' })
    }
  }

  const subject = `🚔 You're falling behind — MAANG won't wait`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:28px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🚔 LeetMastery Police</div>
      <div style="color:#fee2e2;font-size:14px;font-weight:600;margin-top:4px;">You're slipping off the plan.</div>
    </div>

    <div style="padding:28px 30px;">
      <p style="color:#111827;font-size:16px;font-weight:800;margin:0 0 10px;">
        Real talk — you want MAANG? Stop slacking.
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Your study plan is behind schedule. The people getting those offers aren't taking days off — they're grinding right now while you're reading this email.
      </p>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;">
        You don't need motivation. You need to <strong>open the app and solve one question.</strong> Just one. Then another. That's the whole plan.
      </p>

      <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:12px;padding:16px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">📅 You're behind on your daily plan.</p>
        <p style="margin:6px 0 0;font-size:13px;color:#ef4444;line-height:1.5;">
          Every day you skip makes it harder to catch up. Open the app now and get back on track — even one session breaks the slump.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${APP_URL}/daily" style="display:inline-block;background:#dc2626;color:#fff;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;letter-spacing:-0.3px;">
          Get Back On Track →
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;line-height:1.6;">
        You set this plan for a reason. Don't let yourself down.<br/>
        FAANG waits for no one. 💪
      </p>
    </div>

    <div style="padding:14px 30px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · sent because your plan is behind calendar schedule</p>
    </div>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: emailData, error } = await resend.emails.send({
    from: 'LeetMastery <onboarding@resend.dev>',
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[notify-slacking] Resend error:', error)
    return NextResponse.json({ error }, { status: 500 })
  }

  // Stamp cooldown (best-effort — ignore if column doesn't exist yet)
  await supabase
    .from('study_plan')
    .update({ last_slacking_notified_at: new Date().toISOString() })
    .eq('user_id', USER_ID)

  return NextResponse.json({ sent: true, emailId: emailData?.id })
}
