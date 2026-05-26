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
  // ── Preview mode (dev only) ───────────────────────────────────────────────────
  // ?preview=1 → skip auth + skip Resend; returns raw HTML so you can inspect
  // the email in a browser. Blocked in production.
  const isPreview = req.nextUrl.searchParams.get('preview') === '1'
    && process.env.NODE_ENV !== 'production'

  // ── Auth ──────────────────────────────────────────────────────────────────────
  if (!isPreview) {
    const authHeader  = req.headers.get('authorization') ?? ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const secret      = bearerToken ?? req.nextUrl.searchParams.get('secret')
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const to = process.env.NOTIFICATION_EMAIL ? [process.env.NOTIFICATION_EMAIL] : []
  if (!isPreview && to.length === 0) {
    return NextResponse.json({ error: 'Missing NOTIFICATION_EMAIL env var' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  )

  // Hoist todayStr so the preview mock can use addDays() without forward-ref errors
  const todayStr = todayCT()

  // ── Cooldown guard: never send more than once per 90 minutes ─────────────────
  // Prevents duplicate emails if the cron fires twice or interval is too short.
  // Skipped in preview mode so you always get the HTML.
  const COOLDOWN_MS = 90 * 60 * 1000 // 90 minutes
  if (!isPreview) {
    const { data: planMeta } = await supabase
      .from('study_plan')
      .select('last_notified_at')
      .eq('user_id', USER_ID)
      .maybeSingle()
    if (planMeta?.last_notified_at) {
      const msSinceLast = Date.now() - new Date(planMeta.last_notified_at as string).getTime()
      if (msSinceLast < COOLDOWN_MS) {
        const minsLeft = Math.ceil((COOLDOWN_MS - msSinceLast) / 60000)
        return NextResponse.json({ skipped: `Cooldown active — ${minsLeft} min until next allowed email` })
      }
    }
  }

  // ── Check email enabled ───────────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('user_settings')
    .select('email_enabled,review_start_days')
    .eq('user_id', USER_ID)
    .maybeSingle()
  if (!isPreview && settings?.email_enabled === false) {
    return NextResponse.json({ skipped: 'Email disabled by user' })
  }
  // review_start_days: read from study_plan first (always saved there now),
  // fall back to user_settings (if table exists), then hard default 14
  // — resolved later once we have the plan row
  const settingsReviewDays = (settings?.review_start_days as number | null) ?? null

  const qMap = loadQuestionMap()

  // ── Today's daily plan questions ──────────────────────────────────────────────
  const todayPlanQs = await getTodayPlanQuestions(supabase, qMap)
  const hasPlan     = todayPlanQs.length > 0

  const solvedCount = hasPlan ? todayPlanQs.filter(q => q.solved).length : 0
  const totalCount  = hasPlan ? todayPlanQs.length : 0
  const unsolvedQs  = hasPlan ? todayPlanQs.filter(q => !q.solved) : []
  const dailiesDone = hasPlan && unsolvedQs.length === 0

  // ── Due SR reviews (already completed ones have next_review pushed to future) ─
  const { data: srRows } = await supabase
    .from('progress')
    .select('question_id,review_count,next_review')
    .eq('user_id', USER_ID)
    .eq('solved', true)
    .not('next_review', 'is', null)
    .lte('next_review', todayStr)
    .order('next_review', { ascending: true })

  const dueReviews    = (srRows ?? []) as Array<{ question_id: number; review_count: number; next_review: string }>
  const reviewsActive = dueReviews.length > 0

  // Count how many reviews were completed today (for display context)
  const { count: reviewsDoneCount } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('last_reviewed', todayStr)
  const reviewsDone = reviewsDoneCount ?? 0

  // ── Nothing to do? ────────────────────────────────────────────────────────────
  // No plan + no reviews = nothing to surface; skip entirely.
  // Day complete = send a congratulatory email (not a skip — handled below).
  if (!isPreview) {
    if (!hasPlan && !reviewsActive) {
      return NextResponse.json({ skipped: 'No study plan set and no SR reviews due' })
    }
  }

  // Flag: the day is fully done — no pending dailies AND no due reviews.
  // Drives whether we send a congrats email vs a reminder email.
  const isDayComplete = hasPlan && dailiesDone && !reviewsActive

  // ── Absence detection: how many days since last activity? ─────────────────────
  // Check both solved_log (new solves) and progress.last_reviewed (SR reviews).
  const [{ data: lastSolvedRow }, { data: lastReviewedRow }] = await Promise.all([
    supabase
      .from('solved_log')
      .select('date')
      .eq('user_id', USER_ID)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('progress')
      .select('last_reviewed')
      .eq('user_id', USER_ID)
      .not('last_reviewed', 'is', null)
      .order('last_reviewed', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lastSolvedDate   = (lastSolvedRow?.date    as string | null) ?? null
  const lastReviewDate   = (lastReviewedRow?.last_reviewed as string | null) ?? null
  // Pick whichever is more recent
  let lastActivityDate: string | null = null
  if (lastSolvedDate && lastReviewDate) {
    lastActivityDate = lastSolvedDate > lastReviewDate ? lastSolvedDate : lastReviewDate
  } else {
    lastActivityDate = lastSolvedDate ?? lastReviewDate
  }
  // daysAbsent = 0 if active today, 1 if yesterday, 2+ if away
  const daysAbsent = lastActivityDate ? daysBetween(lastActivityDate, todayStr) : 0

  // ── When do reviews start? (if none yet) ─────────────────────────────────────
  // Read review_start_days from study_plan (saved there since latest build),
  // fall back to user_settings value, then default 14.
  let reviewsStartIn: number | null = null
  if (!reviewsActive) {
    const { data: planRow } = await supabase
      .from('study_plan')
      .select('start_date,review_start_days')
      .eq('user_id', USER_ID)
      .maybeSingle()
    if (planRow?.start_date) {
      // Priority: study_plan column → user_settings → default 14
      const reviewStartDays: number =
        (planRow.review_start_days as number | null) ??
        settingsReviewDays ??
        14
      const reviewWindowOpens = addDays(planRow.start_date as string, reviewStartDays)
      const daysUntilOpen     = daysBetween(todayStr, reviewWindowOpens)
      reviewsStartIn = daysUntilOpen > 0 ? daysUntilOpen : null
    }
  }

  // ── Build email HTML ─────────────────────────────────────────────────────────

  let subject: string
  let html: string

  // ── CONGRATS EMAIL (day complete) ─────────────────────────────────────────────
  if (isDayComplete) {
    // Two flavours:
    //   reviewsDone > 0  → both dailies AND reviews were cleared today
    //   reviewsStartIn   → only dailies done, reviews haven't started yet
    //   otherwise        → dailies done, reviews started but nothing was due today
    const bothDone    = reviewsDone > 0
    const preReviews  = !bothDone && reviewsStartIn !== null

    if (bothDone) {
      subject = `🎉 Day complete — questions & reviews done!`
    } else if (preReviews) {
      subject = `🎉 Daily questions done — reviews start in ${reviewsStartIn} day${reviewsStartIn !== 1 ? 's' : ''}!`
    } else {
      subject = `🎉 Daily questions done — great work!`
    }

    const congratsHeadline = bothDone
      ? 'All done for today! 🎉'
      : 'Daily questions done! 🎉'

    const congratsBody = bothDone
      ? `Amazing work — you finished all ${totalCount} daily question${totalCount !== 1 ? 's' : ''} AND cleared your ${reviewsDone} review${reviewsDone !== 1 ? 's' : ''} today. Take a well-earned break and see you tomorrow! 💪`
      : preReviews
        ? `You finished all ${totalCount} question${totalCount !== 1 ? 's' : ''} for today — great consistency! Your first spaced-repetition reviews are scheduled to start in ${reviewsStartIn} day${reviewsStartIn !== 1 ? 's' : ''}. Keep solving daily and they'll be ready for you.`
        : `You finished all ${totalCount} question${totalCount !== 1 ? 's' : ''} for today and no reviews were due. Keep the streak going — see you tomorrow!`

    // Show the questions that were completed today
    const solvedTodayRows = todayPlanQs.map(q => {
      const lcLink = q.slug ? leetCodeUrl(resolveLeetCodeSlug(q.id, q.slug)) : null
      return `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #f0fdf4;vertical-align:middle;">
            <span style="font-size:12px;margin-right:6px;">✅</span>
            <a href="${APP_URL}/question/${q.id}" style="color:#15803d;text-decoration:none;font-weight:600;">#${q.id} ${q.title}</a>
            ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
          </td>
          <td style="padding:9px 0;border-bottom:1px solid #f0fdf4;text-align:right;vertical-align:middle;">
            <span style="color:${diffColor[q.difficulty] ?? '#6b7280'};font-weight:700;font-size:12px;">${q.difficulty}</span>
          </td>
        </tr>`
    }).join('')

    const reviewsSummary = bothDone
      ? `<div style="margin-top:16px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:13px 16px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#6d28d9;">🔁 ${reviewsDone} review${reviewsDone !== 1 ? 's' : ''} cleared today</p>
          <p style="margin:4px 0 0;font-size:12px;color:#7c3aed;">Next reviews will be rescheduled and ready when due.</p>
        </div>`
      : preReviews
        ? `<div style="margin-top:16px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:13px 16px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#6d28d9;">🔁 Reviews start in ${reviewsStartIn} day${reviewsStartIn !== 1 ? 's' : ''}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#7c3aed;">Spaced-repetition reviews will kick in automatically once the window opens.</p>
          </div>`
        : ''

    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#16a34a,#4ade80);padding:26px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🧠 LeetMastery</div>
      <div style="color:#dcfce7;font-size:13px;margin-top:4px;">${congratsHeadline}</div>
    </div>

    <div style="padding:26px 30px;">
      <p style="color:#374151;margin:0 0 20px;font-size:14px;line-height:1.6;">${congratsBody}</p>

      <div style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <span style="font-size:15px;margin-right:8px;">📝</span>
          <span style="font-size:14px;font-weight:700;color:#111827;">Today&apos;s Questions</span>
          <span style="margin-left:auto;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;">${totalCount}/${totalCount} done</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${solvedTodayRows}</table>
      </div>

      ${reviewsSummary}

      <div style="margin-top:20px;text-align:center;">
        <a href="${APP_URL}/daily" style="display:inline-block;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;padding:11px 28px;border-radius:10px;font-size:13px;">View Progress →</a>
      </div>
    </div>

    <div style="padding:14px 30px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">LeetMastery · keep the streak going 🔥</p>
    </div>
  </div>
</body>
</html>`

  } else {
    // ── REMINDER EMAIL (work still pending) ───────────────────────────────────

    // Subject
    const pendingParts: string[] = []
    if (hasPlan && !dailiesDone) pendingParts.push(`${unsolvedQs.length} question${unsolvedQs.length !== 1 ? 's' : ''} left`)
    if (reviewsActive) pendingParts.push(`${dueReviews.length} review${dueReviews.length !== 1 ? 's' : ''} due`)
    if (!hasPlan) pendingParts.push('no daily plan set')
    subject = daysAbsent >= 2
      ? `🚨 ${daysAbsent} day${daysAbsent !== 1 ? 's' : ''} away — get back on track`
      : pendingParts.length
        ? `🧠 ${pendingParts.join(' · ')} — finish the day`
        : `🧠 ${solvedCount}/${totalCount} done — day in progress`

    // Header subtitle
    const headerSubtitle = daysAbsent >= 2
      ? `${daysAbsent} days away — come back strong 💪`
      : 'Finish the day strong'

    // Body intro text
    const bodyText = daysAbsent >= 2
      ? `You haven't practiced in ${daysAbsent} days. Here's what's waiting for you today — let's get back on track.`
      : !hasPlan
        ? reviewsActive
          ? 'You have SR reviews due. Clear them below — and set up your daily plan to start getting question reminders too.'
          : 'Set up your daily plan to start getting daily question reminders.'
        : dailiesDone
          ? 'Your questions are done — clear your reviews to finish the day.'
          : reviewsActive
            ? 'Solve your daily questions and clear your reviews to finish the day.'
            : 'Solve your daily questions to finish the day.'

    // Absence banner
    const absenceBanner = daysAbsent >= 2
      ? `<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">🚨 You haven't practiced in ${daysAbsent} day${daysAbsent !== 1 ? 's' : ''}!</p>
          <p style="margin:4px 0 0;font-size:12px;color:#ef4444;line-height:1.5;">Don't let all that progress slip — even one session gets you back on track.</p>
        </div>`
      : ''

    // No-plan banner
    const noPlanBanner = !hasPlan
      ? `<div style="margin-bottom:20px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#92400e;">📅 No daily plan set up yet</p>
          <p style="margin:6px 0 8px;font-size:12px;color:#b45309;line-height:1.5;">Create a daily plan to get personalised question reminders every day — choose how many questions per day, your start date, and a lock code to keep yourself accountable.</p>
          <div style="text-align:center;">
            <a href="${APP_URL}/daily" style="display:inline-block;background:#d97706;color:#fff;font-weight:700;text-decoration:none;padding:10px 22px;border-radius:10px;font-size:13px;">Set up daily plan →</a>
          </div>
        </div>`
      : ''

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

    const questionsSection = !hasPlan
      ? noPlanBanner
      : !dailiesDone
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
        const q           = qMap[r.question_id]
        const diff        = q?.difficulty ?? ''
        const lcLink      = q?.slug ? leetCodeUrl(resolveLeetCodeSlug(r.question_id, q.slug)) : null
        const overdueDays = r.next_review ? daysBetween(r.next_review, todayStr) : 0
        const overdueLabel = overdueDays === 0 ? 'Due today' : `${overdueDays}d overdue`
        const overdueColor = overdueDays === 0 ? '#7c3aed' : '#dc2626'
        const overdueBg    = overdueDays === 0 ? '#ede9fe'  : '#fee2e2'
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
              <span style="font-size:13px;margin-right:6px;">🔁</span>
              <a href="${APP_URL}/review" style="color:#7c3aed;text-decoration:none;font-weight:600;">#${r.question_id} ${q?.title ?? `Question ${r.question_id}`}</a>
              ${lcLink ? `&nbsp;<a href="${lcLink}" style="color:#9ca3af;font-size:12px;text-decoration:none;">[LC ↗]</a>` : ''}
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;vertical-align:middle;white-space:nowrap;">
              <span style="color:${diffColor[diff] ?? '#6b7280'};font-weight:700;font-size:12px;margin-right:6px;">${diff}</span>
              <span style="background:${overdueBg};color:${overdueColor};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;">${overdueLabel}</span>
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
      reviewsSection = `
        <div style="border-top:1.5px solid #f3f4f6;padding-top:20px;margin-top:4px;">
          <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:14px 18px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#6d28d9;">🔁 Spaced repetition reviews start in ${reviewsStartIn} day${reviewsStartIn !== 1 ? 's' : ''}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#7c3aed;line-height:1.5;">Keep solving — once your first review window opens, reminders will include them too.</p>
          </div>
        </div>`
    }

    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:26px 30px;">
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🧠 LeetMastery</div>
      <div style="color:#ede9fe;font-size:13px;margin-top:4px;">${headerSubtitle}</div>
    </div>

    <div style="padding:26px 30px;">
      ${absenceBanner}
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
  } // end reminder email

  // ── Preview mode: return real HTML without sending ───────────────────────────
  if (isPreview) {
    const previewLabel = `<p style="text-align:center;font-size:11px;color:#9ca3af;font-family:monospace;margin-bottom:16px;">📧 PREVIEW · subject: <strong>${subject}</strong></p>`
    const previewHtml  = html.replace(
      '<div style="max-width:480px',
      previewLabel + '<div style="max-width:480px',
    )
    return new Response(previewHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

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

  // ── Stamp last_notified_at so the cooldown guard works next time ──────────────
  await supabase
    .from('study_plan')
    .update({ last_notified_at: new Date().toISOString() })
    .eq('user_id', USER_ID)

  return NextResponse.json({
    sent:         true,
    dailies:      `${solvedCount}/${totalCount}`,
    reviewsActive,
    dueReviews:   dueReviews.length,
    daysAbsent,
    emailId:      emailData?.id,
  })
}
