import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'

const USER_ID = 'emmanuel'
const TZ = 'America/Chicago'

const diffColor: Record<string, string> = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' }

type QuestionMeta = { title: string; difficulty: string; slug: string }
type QuestionJsonRow = { id: number; title: string; difficulty: string; slug?: string }
type ProgressSolvedRow = { question_id: number | string; solved: boolean | null }
type DueReviewRow = { question_id: number | string; review_count: number | null; status: string | null }

function todayCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

async function congratsAlreadySentToday(supabase: any, todayStr: string): Promise<boolean> {
  // Reuse activity_log as a lightweight "sent marker" without schema changes.
  // count >= 2 means we already sent the congrats email today.
  const { data } = await supabase
    .from('activity_log')
    .select('count')
    .eq('user_id', USER_ID)
    .eq('date', todayStr)
    .maybeSingle()
  const c = Number((data as any)?.count ?? 0) || 0
  return c >= 2
}

async function markCongratsSentToday(supabase: any, todayStr: string): Promise<void> {
  await supabase
    .from('activity_log')
    .upsert({ user_id: USER_ID, date: todayStr, count: 2 }, { onConflict: 'user_id,date' })
}

function buildCongratsHtml(opts: {
  appUrl: string
  title: string
  subtitle: string
  badgeText: string
  extra?: string
}) {
  const { appUrl, title, subtitle, badgeText, extra } = opts
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:26px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">✅ LeetMastery</div>
      <div style="color:#dcfce7;font-size:14px;margin-top:4px;">${subtitle}</div>
    </div>
    <div style="padding:26px 30px;">
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;">${title}</h2>
      <div style="display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;">${badgeText}</div>
      ${extra ? `<div style="margin-top:14px;color:#4b5563;font-size:14px;line-height:1.6;">${extra}</div>` : ''}
      <div style="margin-top:18px;text-align:center;">
        <a href="${appUrl}"
           style="display:inline-block;background:#16a34a;color:#fff;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:12px;font-size:14px;">
          Open LeetMastery →
        </a>
      </div>
    </div>
    <div style="padding:14px 30px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · Central Time</p>
    </div>
  </div>
</body>
</html>`
}

function isWeekendCT(dateISO: string): boolean {
  const weekday = new Date(dateISO + 'T12:00:00').toLocaleString('en-US', { timeZone: TZ, weekday: 'short' })
  return weekday === 'Sat' || weekday === 'Sun'
}

/** How many reviews to SHOW in the email (small — it's just a reminder). */
function emailDisplayCapForDayCT(dateISO: string): number {
  return isWeekendCT(dateISO) ? 4 : 2
}

/** Matches the app's actual spreading cap (db.ts getDailyReviewCapChicago). */
function spreadCapForDayCT(dateISO: string): number {
  return isWeekendCT(dateISO) ? 60 : 35
}

function addDaysCT(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m - 1), d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toLocaleDateString('en-CA', { timeZone: TZ })
}

async function spreadOverdueReviewsForEmail(supabase: any, todayStr: string) {
  const horizonDays = 120

  const { data: rows, error } = await supabase
    .from('progress')
    .select('question_id,next_review,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .order('next_review', { ascending: true })

  if (error) {
    console.error('[notify-daily] spreadOverdueReviews:', error.message)
    return
  }

  const progressRows = (rows ?? []) as Array<{ question_id: number; next_review: string; review_count: number | null }>
  if (!progressRows.length) return

  // Mastery signal: fewer accepted submissions => higher priority to stay earlier.
  const { data: acRows } = await supabase
    .from('ac_submit_counts')
    .select('question_id,count')
    .eq('user_id', USER_ID)
    .in('question_id', progressRows.map(r => r.question_id))

  const acCountById: Record<string, number> = {}
  for (const r of acRows ?? []) {
    acCountById[String((r as any).question_id)] = Number((r as any).count ?? 0) || 0
  }

  const counts: Record<string, number> = {}
  for (const r of progressRows) {
    const day = r.next_review
    if (!day) continue
    counts[day] = (counts[day] ?? 0) + 1
  }

  // Use the same cap the app uses (35 weekday / 60 weekend) so we don't
  // incorrectly displace reviews that the app is still planning to serve today.
  const capToday = spreadCapForDayCT(todayStr)
  const overdue = progressRows
    .filter(r => r.next_review <= todayStr)
    .sort((a, b) => {
      const acA = acCountById[String(a.question_id)] ?? 0
      const acB = acCountById[String(b.question_id)] ?? 0
      if (acA !== acB) return acA - acB
      const rcA = a.review_count ?? 0
      const rcB = b.review_count ?? 0
      if (rcA !== rcB) return rcA - rcB
      if (a.next_review !== b.next_review) return a.next_review.localeCompare(b.next_review)
      return a.question_id - b.question_id
    })

  if (overdue.length <= capToday) return

  const toPush = overdue.slice(capToday)
  const updates: Array<{ question_id: number; next_review: string }> = []

  for (const r of toPush) {
    counts[r.next_review] = Math.max(0, (counts[r.next_review] ?? 1) - 1)

    let placed = false
    for (let offset = 1; offset <= horizonDays; offset++) {
      const day = addDaysCT(todayStr, offset)
      const cap = spreadCapForDayCT(day)
      if ((counts[day] ?? 0) < cap) {
        counts[day] = (counts[day] ?? 0) + 1
        updates.push({ question_id: r.question_id, next_review: day })
        placed = true
        break
      }
    }

    if (!placed) {
      const day = addDaysCT(todayStr, horizonDays + 1)
      counts[day] = (counts[day] ?? 0) + 1
      updates.push({ question_id: r.question_id, next_review: day })
    }
  }

  for (const u of updates) {
    await (supabase.from('progress') as any)
      .update({ next_review: u.next_review })
      .eq('user_id', USER_ID)
      .eq('question_id', u.question_id)
  }
}

function nowHourCT(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  return parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
}

function loadQuestionMap(): Record<number, QuestionMeta> {
  const qMap: Record<number, QuestionMeta> = {}
  try {
    const raw = readFileSync(join(process.cwd(), 'public', 'questions_full.json'), 'utf-8')
    const allQuestions = JSON.parse(raw) as QuestionJsonRow[]
    for (const q of allQuestions) {
      qMap[q.id] = { title: q.title, difficulty: q.difficulty, slug: q.slug ?? '' }
    }
  } catch {
    /* ignore */
  }
  return qMap
}

/** SR table + CTA — shared by full daily email and SR-only (post-plan) email. */
function buildSrBlockHtml(
  dueReviews: DueReviewRow[],
  qMap: Record<number, QuestionMeta>,
  appUrl: string,
  opts?: { sectionMarginTop?: string },
) {
  if (dueReviews.length === 0) return ''
  const sectionMarginTop = opts?.sectionMarginTop ?? '0'
  const rows = dueReviews.map(r => {
    const qid = Number(r.question_id)
    const q = qMap[qid]
    const diff = q?.difficulty ?? ''
    const lcLink = q?.slug ? leetCodeUrl(resolveLeetCodeSlug(qid, q.slug)) : null
    const reviewNum = (r.review_count ?? 0) + 1
    return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
              <span style="font-size:14px;margin-right:6px;">🔁</span>
              <a href="${appUrl}/question/${qid}" style="color:#7c3aed;text-decoration:none;font-weight:600;">#${qid} ${q?.title ?? `Question ${qid}`}</a>
              ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;white-space:nowrap;">
              <span style="color:${diffColor[diff] ?? '#6b7280'};font-weight:700;font-size:12px;margin-right:6px;">${diff}</span>
              <span style="background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;">Review #${reviewNum}</span>
            </td>
          </tr>`
  }).join('')

  return `
      <div style="margin-top:${sectionMarginTop};border-top:2px solid #f3f4f6;padding-top:24px;">
        <div style="display:flex;align-items:center;margin-bottom:16px;">
          <span style="font-size:18px;margin-right:8px;">🧠</span>
          <span style="font-size:15px;font-weight:700;color:#111827;">Spaced Repetition</span>
          <span style="margin-left:auto;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">${dueReviews.length} scheduled</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <div style="margin-top:16px;text-align:center;">
          <a href="${appUrl}/review"
             style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;">
            Start Reviews →
          </a>
        </div>
      </div>`
}

function getNotificationRecipients(): string[] {
  const email = process.env.NOTIFICATION_EMAIL
  return email ? [email] : []
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

  const { data: plan } = await supabase
    .from('study_plan')
    .select('*')
    .eq('user_id', USER_ID)
    .single()

  if (!plan) return NextResponse.json({ skipped: 'No study plan found' })

  const { data: progressRows } = await supabase
    .from('progress')
    .select('question_id,solved')
    .eq('user_id', USER_ID)

  const solvedSet = new Set<number>(
    ((progressRows ?? []) as ProgressSolvedRow[]).filter(r => r.solved).map(r => Number(r.question_id)),
  )

  const todayStr = todayCT()
  const start = new Date(plan.start_date + 'T00:00:00')
  const now = new Date(todayStr + 'T00:00:00')
  start.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = Math.ceil(plan.question_order.length / plan.per_day)

  const qMap = loadQuestionMap()

  // Make email consistent with app: spread SR forward under the same daily caps.
  await spreadOverdueReviewsForEmail(supabase, todayStr)

  const { data: srRows } = await supabase
    .from('progress')
    .select('question_id,review_count,status')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', todayStr)
    .order('next_review', { ascending: true })

  // Email shows a small number of reviews (display cap), even though the app
  // may have up to 35/60 due today. We don't want a wall-of-text email.
  const emailCap = emailDisplayCapForDayCT(todayStr)
  const dueReviews: DueReviewRow[] = ((srRows ?? []) as DueReviewRow[]).slice(0, emailCap)

  // Count reviews already completed today — if ≥ display cap, treat as done.
  const { count: reviewsDoneToday } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('last_reviewed', todayStr)
  const reviewsSatisfied = dueReviews.length === 0 || (reviewsDoneToday ?? 0) >= emailCap
  const dueReviewsForEmail = reviewsSatisfied ? [] : dueReviews

  const appUrl = 'https://leetcodemr.vercel.app'
  const hour = nowHourCT()
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'

  const greetings: Record<string, string> = {
    morning: '☀️ Good morning!',
    afternoon: '🌤 Afternoon check-in!',
    evening: '🌆 Evening reminder!',
    night: '🌙 Late-night heads up!',
  }

  // ── Plan calendar ended: SR-only reminders (lighter email) ─────────────────
  if (diffDays >= totalDays) {
    // If SR is satisfied (no due, or ≥5 completed), stop emailing for the day.
    if (reviewsSatisfied) {
      return NextResponse.json({ skipped: 'Plan calendar ended; no SR due' })
    }

    const n = dueReviewsForEmail.length
    const srSubjects: Record<string, string> = {
      morning: `🧠 ${n} spaced-rep review${n !== 1 ? 's' : ''} due (plan done)`,
      afternoon: `🧠 Reviews due today — ${n} question${n !== 1 ? 's' : ''}`,
      evening: `🧠 ${n} review${n !== 1 ? 's' : ''} waiting · SR queue`,
      night: `🧠 Before bed: ${n} review${n !== 1 ? 's' : ''} due`,
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:24px 28px;">
      <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🧠 LeetMastery</div>
      <div style="color:#ede9fe;font-size:13px;margin-top:6px;">Spaced repetition · Daily plan calendar finished</div>
    </div>

    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 8px;font-size:19px;color:#111827;">${greetings[tod]}</h2>
      <p style="color:#4b5563;margin:0 0 20px;font-size:14px;line-height:1.5;">
        Your study-plan days are complete, but <strong>${n}</strong> spaced-repetition review${n !== 1 ? 's are' : ' is'} due today. Knock them out to stay sharp.
      </p>
      ${buildSrBlockHtml(dueReviewsForEmail, qMap, appUrl)}
    </div>

    <div style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · Central Time · Sent daily at 8 AM</p>
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
      subject: srSubjects[tod],
      html,
    })

    if (error) {
      console.error('[notify-daily] Resend error:', error)
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({
      sent: true,
      mode: 'sr-only',
      dueReviews: n,
      emailId: emailData?.id,
    })
  }

  if (diffDays < 0) {
    return NextResponse.json({ skipped: 'Plan not started yet' })
  }

  const planMode: string = (plan as any).mode ?? 'strict'
  const isRandomMode = planMode === 'random'

  // ── RANDOM MODE: quota-based (any questions from pool) ────────────────────
  if (isRandomMode) {
    const { data: solvedLogRow } = await supabase
      .from('solved_log')
      .select('count')
      .eq('user_id', USER_ID)
      .eq('date', todayStr)
      .single()

    const solvedToday = (solvedLogRow as any)?.count ?? 0
    const perDay = plan.per_day ?? 1
    const remaining = Math.max(0, perDay - solvedToday)

    if (remaining === 0 && reviewsSatisfied) {
      // Send a one-time congrats email, then stop emailing for the day.
      if (!(await congratsAlreadySentToday(supabase, todayStr))) {
        const to = getNotificationRecipients()
        if (to.length === 0) {
          return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL' }, { status: 500 })
        }
        const htmlCongrats = buildCongratsHtml({
          appUrl: appUrl + '/daily',
          title: greetings[tod],
          subtitle: `Random Mode · ${perDay} questions/day`,
          badgeText: `You finished today · ${solvedToday}/${perDay}`,
          extra: `Great work — you hit your daily quota and your reviews are clear. Enjoy the rest of your day.`,
        })
        const { data: emailData, error } = await resend.emails.send({
          from: 'LeetMastery <onboarding@resend.dev>',
          to,
          subject: `✅ Done for today — ${solvedToday}/${perDay} solved`,
          html: htmlCongrats,
        })
        if (error) {
          console.error('[notify-daily] Resend error (random congrats):', error)
          return NextResponse.json({ error }, { status: 500 })
        }
        await markCongratsSentToday(supabase, todayStr)
        return NextResponse.json({ sent: true, mode: 'random-congrats', solvedToday, emailId: emailData?.id })
      }
      return NextResponse.json({ skipped: 'All done for today! (random mode)' })
    }

    const urgencyRandom: Record<string, string> = {
      morning: "Start your day strong — pick any questions and hit your quota.",
      afternoon: "Afternoon check-in — knock out your remaining questions.",
      evening: "Don't let the day slip by — finish your quota tonight.",
      night: "Getting late! Hit your daily quota before midnight.",
    }
    const subjectsRandom: Record<string, string> = {
      morning: `☀️ LeetCode Police — ${remaining} question${remaining !== 1 ? 's' : ''} left today`,
      afternoon: `🌤 Still ${remaining} to go — wrap it up this afternoon!`,
      evening: `🌆 ${remaining} question${remaining !== 1 ? 's' : ''} left — finish tonight!`,
      night: `🌙 ${remaining} left and it's getting late — go finish!`,
    }

    let progressMsgRandom: string
    if (solvedToday === 0) {
      progressMsgRandom = `You haven't solved any questions today yet. Goal: ${perDay}.`
    } else if (remaining === 1) {
      progressMsgRandom = `Almost there — just 1 more question to hit your ${perDay}/day goal!`
    } else if (remaining === 0) {
      progressMsgRandom = `Daily quota complete — ${solvedToday}/${perDay} solved today! 🎉`
    } else {
      progressMsgRandom = `You've solved ${solvedToday}/${perDay} today — keep the momentum going.`
    }

    const srSectionRandom =
      dueReviewsForEmail.length > 0
        ? buildSrBlockHtml(dueReviewsForEmail, qMap, appUrl, { sectionMarginTop: '28px' })
        : `
      <div style="margin-top:28px;border-top:2px solid #f3f4f6;padding-top:24px;">
        <div style="display:flex;align-items:center;">
          <span style="font-size:18px;margin-right:8px;">🧠</span>
          <span style="font-size:15px;font-weight:700;color:#111827;">Spaced Repetition</span>
          <span style="margin-left:auto;color:#16a34a;font-size:13px;font-weight:600;">All caught up ✓</span>
        </div>
      </div>`

    const progressBarPct = Math.min(100, Math.round((solvedToday / perDay) * 100))
    const htmlRandom = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:28px 32px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🎲 LeetMastery</div>
      <div style="color:#ede9fe;font-size:14px;margin-top:4px;">Random Mode · ${perDay} questions/day</div>
    </div>

    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 6px;font-size:20px;color:#111827;">${greetings[tod]}</h2>
      <p style="color:#374151;margin:0 0 6px;font-size:15px;">${urgencyRandom[tod]}</p>
      <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">${progressMsgRandom}</p>

      <div style="background:#f5f3ff;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-weight:700;color:#7c3aed;font-size:15px;">Today's Progress</span>
          <span style="font-size:14px;font-weight:600;color:#4b5563;">${solvedToday} / ${perDay}</span>
        </div>
        <div style="background:#ddd6fe;border-radius:99px;height:10px;overflow:hidden;">
          <div style="background:#7c3aed;height:100%;border-radius:99px;width:${progressBarPct}%;transition:width 0.3s;"></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#7c3aed;font-weight:600;">${progressBarPct}% complete</div>
      </div>

      ${remaining > 0 ? `
      <div style="text-align:center;">
        <a href="${appUrl}/daily"
           style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;">
          Go Solve Now →
        </a>
      </div>` : `
      <div style="padding:12px 16px;background:#f0fdf4;border-radius:10px;text-align:center;">
        <span style="color:#16a34a;font-weight:700;font-size:14px;">✅ Daily quota complete!</span>
      </div>`}
      ${srSectionRandom}
    </div>

    <div style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · Central Time · Random Mode</p>
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
      subject: subjectsRandom[tod],
      html: htmlRandom,
    })

    if (error) {
      console.error('[notify-daily] Resend error (random):', error)
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ sent: true, mode: 'random', solvedToday, remaining, emailId: emailData?.id })
  }

  // ── STRICT MODE: fixed day-slice (original behavior) ──────────────────────
  let activeDayIndex = diffDays
  for (let i = 0; i <= diffDays; i++) {
    const ids: number[] = plan.question_order.slice(i * plan.per_day, i * plan.per_day + plan.per_day)
    if (!ids.every(id => solvedSet.has(id))) {
      activeDayIndex = i
      break
    }
  }

  const dayIds: number[] = plan.question_order.slice(
    activeDayIndex * plan.per_day,
    activeDayIndex * plan.per_day + plan.per_day,
  )

  const solvedToday = dayIds.filter(id => solvedSet.has(id)).length
  const remaining = dayIds.length - solvedToday

  if (remaining === 0 && reviewsSatisfied) {
    // Send a one-time congrats email, then stop emailing for the day.
    if (!(await congratsAlreadySentToday(supabase, todayStr))) {
      const to = getNotificationRecipients()
      if (to.length === 0) {
        return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL' }, { status: 500 })
      }
      const dayNumber = activeDayIndex + 1
      const htmlCongrats = buildCongratsHtml({
        appUrl: appUrl + '/daily',
        title: greetings[tod],
        subtitle: `Strict Mode · Day ${dayNumber} of ${totalDays}`,
        badgeText: `You finished today · ${solvedToday}/${dayIds.length}`,
        extra: `Nice — today’s daily block is complete and your reviews are clear. Keep the streak alive.`,
      })
      const { data: emailData, error } = await resend.emails.send({
        from: 'LeetMastery <onboarding@resend.dev>',
        to,
        subject: `✅ Done for today — Day ${dayNumber} complete`,
        html: htmlCongrats,
      })
      if (error) {
        console.error('[notify-daily] Resend error (strict congrats):', error)
        return NextResponse.json({ error }, { status: 500 })
      }
      await markCongratsSentToday(supabase, todayStr)
      return NextResponse.json({ sent: true, mode: 'strict-congrats', day: dayNumber, emailId: emailData?.id })
    }
    return NextResponse.json({ skipped: 'All done for today!' })
  }

  const dayNumber = activeDayIndex + 1

  const urgency: Record<string, string> = {
    morning: "Start your day strong — knock out today's questions early.",
    afternoon: "Afternoon's a great time to get these done.",
    evening: "Don't let the day slip by — finish strong tonight.",
    night: "Getting late! Finish up before midnight. You've got this.",
  }
  const subjects: Record<string, string> = {
    morning: `☀️ LeetCode Police — Day ${dayNumber}: ${remaining} question${remaining !== 1 ? 's' : ''} left`,
    afternoon: `🌤 Day ${dayNumber}: Still ${remaining} to go — wrap it up this afternoon!`,
    evening: `🌆 Day ${dayNumber}: ${remaining} question${remaining !== 1 ? 's' : ''} left — finish tonight!`,
    night: `🌙 Day ${dayNumber}: ${remaining} left and it's getting late — go finish!`,
  }

  let progressMsg: string
  if (solvedToday === 0) {
    progressMsg = "You haven't started today's questions yet."
  } else if (remaining === 1) {
    progressMsg = `Almost there — just 1 question left!`
  } else {
    progressMsg = `You've completed ${solvedToday}/${dayIds.length} — keep the momentum going.`
  }

  const rows = dayIds.map(id => {
    const q = qMap[id]
    const solved = solvedSet.has(id)
    const diff = q?.difficulty ?? ''
    const lcLink = q?.slug ? leetCodeUrl(resolveLeetCodeSlug(id, q.slug)) : null
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <span style="font-size:16px;margin-right:8px;">${solved ? '✅' : '⭕'}</span>
          <a href="${appUrl}/question/${id}" style="color:#4f46e5;text-decoration:none;font-weight:600;">#${id} ${q?.title ?? `Question ${id}`}</a>
          ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;">
          <span style="color:${diffColor[diff] ?? '#6b7280'};font-weight:700;font-size:13px;">${diff}</span>
        </td>
      </tr>`
  }).join('')

  const srSectionWhenMixed =
    dueReviewsForEmail.length > 0
      ? buildSrBlockHtml(dueReviewsForEmail, qMap, appUrl, { sectionMarginTop: '28px' })
      : `
      <div style="margin-top:28px;border-top:2px solid #f3f4f6;padding-top:24px;">
        <div style="display:flex;align-items:center;">
          <span style="font-size:18px;margin-right:8px;">🧠</span>
          <span style="font-size:15px;font-weight:700;color:#111827;">Spaced Repetition</span>
          <span style="margin-left:auto;color:#16a34a;font-size:13px;font-weight:600;">All caught up ✓</span>
        </div>
      </div>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">📚 LeetMastery</div>
      <div style="color:#c7d2fe;font-size:14px;margin-top:4px;">LeetCode Police · Day ${dayNumber} of ${totalDays}</div>
    </div>

    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 6px;font-size:20px;color:#111827;">${greetings[tod]}</h2>
      <p style="color:#374151;margin:0 0 6px;font-size:15px;">${urgency[tod]}</p>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">${progressMsg}</p>

      <table style="width:100%;border-collapse:collapse;">${rows}</table>

      ${remaining > 0 ? `
      <div style="margin-top:28px;text-align:center;">
        <a href="${appUrl}/daily"
           style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;">
          Go Solve Now →
        </a>
      </div>` : `
      <div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-radius:10px;text-align:center;">
        <span style="color:#16a34a;font-weight:700;font-size:14px;">✅ Daily questions complete!</span>
      </div>`}
      ${srSectionWhenMixed}
    </div>

    <div style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · Central Time · Sent daily at 8 AM</p>
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

  return NextResponse.json({ sent: true, mode: 'strict', remaining, day: dayNumber, emailId: emailData?.id })
}
