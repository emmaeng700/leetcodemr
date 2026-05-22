import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'

const USER_ID = 'emmanuel'
const TZ      = 'America/Chicago'
const APP_URL = 'https://leetcodemr.vercel.app'

const diffColor: Record<string, string> = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' }

type QuestionMeta    = { title: string; difficulty: string; slug: string }
type QuestionJsonRow = { id: number; title: string; difficulty: string; slug?: string }

function todayCT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T12:00:00')
  const b = new Date(toISO   + 'T12:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
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

/** Today's active day questions — mirrors the daily page "first incomplete day" logic. */
async function getTodayPlanQuestions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  qMap: Record<number, QuestionMeta>,
): Promise<Array<{ id: number; title: string; difficulty: string; slug: string; solved: boolean }>> {
  const [planRes, progressRes] = await Promise.all([
    supabase.from('study_plan').select('question_order,start_date,per_day').eq('user_id', USER_ID).maybeSingle(),
    supabase.from('progress').select('question_id').eq('user_id', USER_ID).eq('solved', true),
  ])

  const plan = planRes.data as { question_order: number[]; start_date: string; per_day: number } | null
  if (!plan?.question_order?.length || !plan?.start_date || !plan?.per_day) return []

  const solvedIds = new Set<number>((progressRes.data ?? []).map((r: any) => Number(r.question_id)))

  const today    = todayCT()
  const diffDays = daysBetween(plan.start_date, today)
  if (diffDays < 0) return []

  const order: number[] = plan.question_order
  const perDay: number  = plan.per_day
  const totalDays       = Math.ceil(order.length / perDay)

  // Find the first day that still has unsolved questions (up to today's scheduled day)
  let activeDayIndex = Math.min(diffDays, totalDays - 1)
  for (let i = 0; i <= Math.min(diffDays, totalDays - 1); i++) {
    const slice = order.slice(i * perDay, i * perDay + perDay)
    if (slice.some(id => !solvedIds.has(id))) { activeDayIndex = i; break }
  }

  const todayIds = order.slice(activeDayIndex * perDay, activeDayIndex * perDay + perDay)
  return todayIds.map(id => {
    const q = qMap[id]
    return {
      id,
      title:      q?.title      ?? `Question ${id}`,
      difficulty: q?.difficulty ?? '',
      slug:       q?.slug       ?? '',
      solved:     solvedIds.has(id),
    }
  })
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const secret      = bearerToken ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const to = process.env.NOTIFICATION_EMAIL ? [process.env.NOTIFICATION_EMAIL] : []
  if (to.length === 0) {
    return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL env var' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // ── Check email enabled + load review_start_days ────────────────────────────
  const { data: settings } = await supabase
    .from('user_settings')
    .select('email_enabled,review_start_days')
    .eq('user_id', USER_ID)
    .maybeSingle()
  if (settings?.email_enabled === false) {
    return NextResponse.json({ skipped: 'Email disabled by user' })
  }
  // How many days after plan start the user configured reviews to begin (14/21/30)
  const reviewStartDays: number = (settings?.review_start_days as number | null) ?? 14

  const todayStr = todayCT()
  const qMap     = loadQuestionMap()

  // ── Today's daily plan questions ──────────────────────────────────────────────
  const todayPlanQs = await getTodayPlanQuestions(supabase, qMap)
  if (todayPlanQs.length === 0) {
    return NextResponse.json({ skipped: 'No study plan or no questions scheduled for today' })
  }

  const solvedCount = todayPlanQs.filter(q => q.solved).length
  const totalCount  = todayPlanQs.length
  const unsolvedQs  = todayPlanQs.filter(q => !q.solved)
  const dailiesDone = unsolvedQs.length === 0

  // ── Due SR reviews (already completed ones have next_review pushed to future) ─
  const { data: srRows } = await supabase
    .from('progress')
    .select('question_id,review_count')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', todayStr)
    .order('next_review', { ascending: true })

  const dueReviews   = (srRows ?? []) as Array<{ question_id: number; review_count: number }>
  const reviewsActive = dueReviews.length > 0

  // Count how many reviews were completed today (for display context)
  const { count: reviewsDoneCount } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('last_reviewed', todayStr)
  const reviewsDone = reviewsDoneCount ?? 0

  // ── Day complete? ─────────────────────────────────────────────────────────────
  if (dailiesDone && !reviewsActive) {
    return NextResponse.json({ skipped: 'Day complete — all dailies done, no reviews due' })
  }

  // ── When do reviews start? (if none yet) ─────────────────────────────────────
  // Use the user-configured review_start_days + plan start_date, NOT next_review
  // from the DB (which is set to srInterval(0)=1 day when a question is first
  // solved — it doesn't reflect the user's chosen review delay at all).
  let reviewsStartIn: number | null = null
  if (!reviewsActive) {
    const { data: planRow } = await supabase
      .from('study_plan')
      .select('start_date')
      .eq('user_id', USER_ID)
      .maybeSingle()
    if (planRow?.start_date) {
      const reviewWindowOpens = addDays(planRow.start_date as string, reviewStartDays)
      const daysUntilOpen     = daysBetween(todayStr, reviewWindowOpens)
      // Only show the countdown if the window hasn't opened yet
      reviewsStartIn = daysUntilOpen > 0 ? daysUntilOpen : null
    }
  }

  // ── Build email HTML ─────────────────────────────────────────────────────────

  // Subject
  const pendingParts: string[] = []
  if (!dailiesDone) pendingParts.push(`${unsolvedQs.length} question${unsolvedQs.length !== 1 ? 's' : ''} left`)
  if (reviewsActive) pendingParts.push(`${dueReviews.length} review${dueReviews.length !== 1 ? 's' : ''} due`)
  const subject = pendingParts.length
    ? `🧠 ${pendingParts.join(' · ')} — finish the day`
    : `🧠 ${solvedCount}/${totalCount} done — day in progress`

  // Body intro text
  const bodyText = dailiesDone
    ? 'Your questions are done — clear your reviews to finish the day.'
    : reviewsActive
      ? 'Solve your daily questions and clear your reviews to finish the day.'
      : 'Solve your daily questions to finish the day.'

  // Daily questions block
  const questionRows = unsolvedQs.map(q => {
    const lcLink = q.slug ? leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug)) : null
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <span style="font-size:13px;margin-right:6px;">📝</span>
          <a href="${APP_URL}/question/${q.id}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">#${q.id} ${q.title}</a>
          ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;">
          <span style="color:${diffColor[q.difficulty] ?? '#6b7280'};font-weight:700;font-size:12px;">${q.difficulty}</span>
        </td>
      </tr>`
  }).join('')

  const questionsSection = !dailiesDone
    ? `<div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <span style="font-size:16px;margin-right:8px;">📝</span>
          <span style="font-size:14px;font-weight:700;color:#111827;">Today&apos;s Questions</span>
          <span style="margin-left:auto;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;">${solvedCount}/${totalCount} done</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${questionRows}</table>
        <div style="margin-top:12px;text-align:center;">
          <a href="${APP_URL}/daily" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;text-decoration:none;padding:11px 24px;border-radius:10px;font-size:13px;">Go solve →</a>
        </div>
      </div>`
    : `<div style="margin-bottom:20px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:14px 18px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#15803d;">✅ All ${totalCount} questions done!</p>
        <p style="margin:4px 0 0;font-size:12px;color:#16a34a;">Great work — now clear your reviews below.</p>
      </div>`

  // Reviews block
  let reviewsSection = ''
  if (reviewsActive) {
    const reviewRows = dueReviews.map(r => {
      const q         = qMap[r.question_id]
      const diff      = q?.difficulty ?? ''
      const lcLink    = q?.slug ? leetCodeUrl(resolveLeetCodeSlug(r.question_id, q.slug)) : null
      const reviewNum = (r.review_count ?? 0) + 1
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
            <span style="font-size:13px;margin-right:6px;">🔁</span>
            <a href="${APP_URL}/review" style="color:#7c3aed;text-decoration:none;font-weight:600;">#${r.question_id} ${q?.title ?? `Question ${r.question_id}`}</a>
            ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;white-space:nowrap;">
            <span style="color:${diffColor[diff] ?? '#6b7280'};font-weight:700;font-size:12px;margin-right:6px;">${diff}</span>
            <span style="background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;">Review #${reviewNum}</span>
          </td>
        </tr>`
    }).join('')

    const doneLabel = reviewsDone > 0
      ? `<span style="margin-left:8px;color:#9ca3af;font-size:11px;">(${reviewsDone} done today)</span>`
      : ''

    reviewsSection = `
      <div style="border-top:1.5px solid #f3f4f6;padding-top:20px;">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <span style="font-size:16px;margin-right:8px;">🔁</span>
          <span style="font-size:14px;font-weight:700;color:#111827;">Due Reviews</span>${doneLabel}
          <span style="margin-left:auto;background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;">${dueReviews.length} remaining</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${reviewRows}</table>
        <div style="margin-top:14px;text-align:center;">
          <a href="${APP_URL}/review" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;text-decoration:none;padding:11px 24px;border-radius:10px;font-size:13px;">Start Reviews →</a>
        </div>
      </div>`
  } else if (reviewsStartIn !== null) {
    // Reviews haven't started yet — show when they will
    reviewsSection = `
      <div style="border-top:1.5px solid #f3f4f6;padding-top:20px;margin-top:4px;">
        <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:14px 18px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#6d28d9;">🔁 Spaced repetition reviews start in ${reviewsStartIn} day${reviewsStartIn !== 1 ? 's' : ''}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#7c3aed;line-height:1.5;">Keep solving — once your first review window opens, reminders will include them too.</p>
        </div>
      </div>`
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:26px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🧠 LeetMastery</div>
      <div style="color:#ede9fe;font-size:13px;margin-top:4px;">Finish the day strong</div>
    </div>

    <div style="padding:26px 30px;">
      <p style="color:#6b7280;margin:0 0 22px;font-size:14px;line-height:1.5;">${bodyText}</p>
      ${questionsSection}
      ${reviewsSection}
    </div>

    <div style="padding:14px 30px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · reminders stop once your day is complete</p>
    </div>
  </div>
</body>
</html>`

  // ── Send ─────────────────────────────────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: emailData, error } = await resend.emails.send({
    from: 'LeetMastery <onboarding@resend.dev>',
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[notify-daily] Resend error:', error)
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({
    sent:         true,
    dailies:      `${solvedCount}/${totalCount}`,
    reviewsActive,
    dueReviews:   dueReviews.length,
    emailId:      emailData?.id,
  })
}
