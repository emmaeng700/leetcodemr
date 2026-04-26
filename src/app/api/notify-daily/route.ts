import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'

const USER_ID = 'emmanuel'
const TZ = 'America/Chicago'
const APP_URL = 'https://leetcodemr.vercel.app'

const diffColor: Record<string, string> = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' }

type QuestionMeta = { title: string; difficulty: string; slug: string }
type QuestionJsonRow = { id: number; title: string; difficulty: string; slug?: string }
type DueReviewRow = { question_id: number | string; review_count: number | null }

function todayCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

function nowHourCT(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', hour12: false,
  }).formatToParts(new Date())
  return parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
}

function loadQuestionMap(): Record<number, QuestionMeta> {
  const qMap: Record<number, QuestionMeta> = {}
  try {
    const raw = readFileSync(join(process.cwd(), 'public', 'questions_full.json'), 'utf-8')
    for (const q of JSON.parse(raw) as QuestionJsonRow[]) {
      qMap[q.id] = { title: q.title, difficulty: q.difficulty, slug: q.slug ?? '' }
    }
  } catch { /* ignore */ }
  return qMap
}

function getNotificationRecipients(): string[] {
  const email = process.env.NOTIFICATION_EMAIL
  return email ? [email] : []
}

function isWeekendCT(dateISO: string): boolean {
  const weekday = new Date(dateISO + 'T12:00:00').toLocaleString('en-US', { timeZone: TZ, weekday: 'short' })
  return weekday === 'Sat' || weekday === 'Sun'
}

function addDaysCT(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toLocaleDateString('en-CA', { timeZone: TZ })
}

function spreadCapForDayCT(dateISO: string): number {
  return isWeekendCT(dateISO) ? 60 : 35
}

async function spreadOverdueReviews(supabase: any, todayStr: string) {
  const { data: rows, error } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .order('next_review', { ascending: true })

  if (error || !rows?.length) return

  const progressRows = rows as Array<{ question_id: number; next_review: string; review_count: number | null }>
  const capToday = spreadCapForDayCT(todayStr)
  const overdue = progressRows.filter(r => r.next_review <= todayStr)
  if (overdue.length <= capToday) return

  const counts: Record<string, number> = {}
  for (const r of progressRows) {
    if (r.next_review) counts[r.next_review] = (counts[r.next_review] ?? 0) + 1
  }

  const toPush = overdue.slice(capToday)
  for (const r of toPush) {
    counts[r.next_review] = Math.max(0, (counts[r.next_review] ?? 1) - 1)
    let placed = false
    for (let offset = 1; offset <= 120; offset++) {
      const day = addDaysCT(todayStr, offset)
      const cap = spreadCapForDayCT(day)
      if ((counts[day] ?? 0) < cap) {
        counts[day] = (counts[day] ?? 0) + 1
        await supabase.from('progress').update({ next_review: day })
          .eq('user_id', USER_ID).eq('question_id', r.question_id)
        placed = true
        break
      }
    }
    if (!placed) {
      const day = addDaysCT(todayStr, 121)
      await supabase.from('progress').update({ next_review: day })
        .eq('user_id', USER_ID).eq('question_id', r.question_id)
    }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const querySecret = req.nextUrl.searchParams.get('secret')
  const secret = bearerSecret ?? querySecret

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const todayStr = todayCT()
  const hour = nowHourCT()
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'

  const greetings: Record<string, string> = {
    morning:   '☀️ Good morning!',
    afternoon: '🌤 Afternoon check-in!',
    evening:   '🌆 Evening reminder!',
    night:     '🌙 Late-night heads up!',
  }

  // Spread overdue reviews so the list stays manageable
  await spreadOverdueReviews(supabase, todayStr)

  // Fetch due reviews for today
  const { data: srRows } = await supabase
    .from('progress')
    .select('question_id,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', todayStr)
    .order('next_review', { ascending: true })

  const dueReviews = (srRows ?? []) as DueReviewRow[]

  // ── All reviews done → day is done, skip email ──────────────────────────────
  if (dueReviews.length === 0) {
    return NextResponse.json({ skipped: 'All reviews done — day complete!' })
  }

  // ── Build email ─────────────────────────────────────────────────────────────
  const qMap = loadQuestionMap()
  const n = dueReviews.length

  const subjects: Record<string, string> = {
    morning:   `🧠 ${n} review${n !== 1 ? 's' : ''} due today — clear them to finish`,
    afternoon: `🧠 ${n} review${n !== 1 ? 's' : ''} waiting — knock them out`,
    evening:   `🧠 ${n} review${n !== 1 ? 's' : ''} left — finish before tonight ends`,
    night:     `🧠 ${n} review${n !== 1 ? 's' : ''} due — quick, before midnight!`,
  }

  const reviewRows = dueReviews.map(r => {
    const qid = Number(r.question_id)
    const q = qMap[qid]
    const diff = q?.difficulty ?? ''
    const lcLink = q?.slug ? leetCodeUrl(resolveLeetCodeSlug(qid, q.slug)) : null
    const reviewNum = (r.review_count ?? 0) + 1
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <span style="font-size:14px;margin-right:6px;">🔁</span>
          <a href="${APP_URL}/question/${qid}" style="color:#7c3aed;text-decoration:none;font-weight:600;">#${qid} ${q?.title ?? `Question ${qid}`}</a>
          ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;white-space:nowrap;">
          <span style="color:${diffColor[diff] ?? '#6b7280'};font-weight:700;font-size:12px;margin-right:6px;">${diff}</span>
          <span style="background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;">Review #${reviewNum}</span>
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:26px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🧠 LeetMastery</div>
      <div style="color:#ede9fe;font-size:13px;margin-top:4px;">Clear your reviews to finish the day</div>
    </div>

    <div style="padding:26px 30px;">
      <h2 style="margin:0 0 6px;font-size:19px;color:#111827;">${greetings[tod]}</h2>
      <p style="color:#6b7280;margin:0 0 22px;font-size:14px;line-height:1.5;">
        You have <strong style="color:#111827;">${n} review${n !== 1 ? 's' : ''}</strong> due today.
        Clear them all and the day is done.
      </p>

      <div style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;margin-bottom:14px;">
          <span style="font-size:16px;margin-right:8px;">🔁</span>
          <span style="font-size:14px;font-weight:700;color:#111827;">Due Reviews</span>
          <span style="margin-left:auto;background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;">${n} to do</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${reviewRows}</table>
      </div>

      <div style="margin-top:20px;text-align:center;">
        <a href="${APP_URL}/review"
           style="display:inline-block;background:#7c3aed;color:#fff;font-weight:800;text-decoration:none;padding:13px 30px;border-radius:12px;font-size:14px;">
          Start Reviews →
        </a>
      </div>

      <div style="margin-top:28px;border-top:2px solid #f3f4f6;padding-top:22px;">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <span style="font-size:16px;margin-right:8px;">💡</span>
          <span style="font-size:14px;font-weight:700;color:#111827;">New Problems</span>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 14px;">
          Solve any problems on LeetCode, then hit <strong style="color:#4f46e5;">LC Sync</strong> in the app to mark them solved automatically.
        </p>
        <div style="text-align:center;">
          <a href="https://leetcode.com/problemset/"
             style="display:inline-block;background:#f9fafb;border:1.5px solid #e5e7eb;color:#374151;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:13px;">
            Open LeetCode ↗
          </a>
        </div>
      </div>
    </div>

    <div style="padding:14px 30px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · Central Time</p>
    </div>
  </div>
</body>
</html>`

  const to = getNotificationRecipients()
  if (to.length === 0) {
    return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL' }, { status: 500 })
  }

  const { data: emailData, error } = await resend.emails.send({
    from: 'LeetMastery <onboarding@resend.dev>',
    to,
    subject: subjects[tod],
    html,
  })

  if (error) {
    console.error('[notify-daily] Resend error:', error)
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ sent: true, dueReviews: n, emailId: emailData?.id })
}
