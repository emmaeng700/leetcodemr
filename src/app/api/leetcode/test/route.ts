import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

const RUN_RATE = { windowMs: 30_000, max: 3, penaltyMs: 60_000 } as const
type Bucket = { count: number; resetAt: number; penaltyUntil: number }
const getBuckets = () =>
  ((globalThis as any).__lc_run_buckets ??= new Map<string, Bucket>()) as Map<string, Bucket>

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    // Soft rate-limit to avoid hammering LeetCode interpret_solution (which triggers 429).
    // Best-effort: in-memory map (works well enough on warm serverless instances).
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const sessKey = String(session).slice(0, 16)
    const key = `${ip}:${sessKey}:${String(titleSlug)}:${String(lang)}`
    const now = Date.now()
    const buckets = getBuckets()
    const b = buckets.get(key) ?? { count: 0, resetAt: now + RUN_RATE.windowMs, penaltyUntil: 0 }
    if (b.resetAt <= now) { b.count = 0; b.resetAt = now + RUN_RATE.windowMs }
    if (b.penaltyUntil > now) {
      const waitSec = Math.ceil((b.penaltyUntil - now) / 1000)
      return NextResponse.json(
        { error: `Run cooldown active. Try again in ${waitSec}s.`, retryAfterSec: waitSec, httpStatus: 429 },
        { status: 429, headers: { 'Retry-After': String(waitSec) } },
      )
    }
    b.count += 1
    if (b.count > RUN_RATE.max) {
      b.penaltyUntil = now + RUN_RATE.penaltyMs
      const waitSec = Math.ceil(RUN_RATE.penaltyMs / 1000)
      buckets.set(key, b)
      return NextResponse.json(
        { error: `Too many Run requests. Cooldown for ${waitSec}s.`, retryAfterSec: waitSec, httpStatus: 429 },
        { status: 429, headers: { 'Retry-After': String(waitSec) } },
      )
    }
    buckets.set(key, b)

    const qid = toLeetCodeQuestionId(questionId)
    const slug = encodeURIComponent(String(titleSlug))
    const url = `${LC}/problems/${slug}/interpret_solution/`
    const input = testInput ?? ''

    // Always use test_mode=false.
    // Many accounts return: "You do not have permissions to use test mode."
    // so trying test_mode=true breaks Run for them.
    const attempts: Array<{ test_mode: false; data_input: string }> = [
      { test_mode: false, data_input: input },
    ]
    if (input.trim() !== '') {
      attempts.push({ test_mode: false, data_input: '' })
    }

    let lastRes: Response | null = null
    let lastText = ''

    for (const a of attempts) {
      const { res, text } = await fetchLeetCodeProblemPost(
        url,
        { lang, question_id: qid, typed_code: code, data_input: a.data_input, test_mode: a.test_mode },
        String(titleSlug),
        session,
        csrfToken,
        // Caller controls outer retries; avoid multiplying requests inside this helper.
        { retryOnHtml: false },
      )
      lastRes = res
      lastText = text

      if (res.status === 429) {
        // Penalize quickly if LeetCode is already rate-limiting.
        const bb = buckets.get(key)
        if (bb) { bb.penaltyUntil = Math.max(bb.penaltyUntil, Date.now() + RUN_RATE.penaltyMs); buckets.set(key, bb) }
        return NextResponse.json(
          {
            error:
              'LeetCode rate-limited this run (HTTP 429). Wait a minute and try Run again — avoid spamming Run while debugging.',
            httpStatus: res.status,
          },
          { status: 429, headers: { 'Retry-After': '60' } },
        )
      }

      const parsed = parseLeetCodeJsonText(text, res.status)
      if (!parsed.ok) continue

      const data = parsed.data as { error?: string; interpret_id?: string }
      if (data?.error && /permissions to use test mode/i.test(String(data.error))) {
        // If LeetCode claims test mode is forbidden, we shouldn't ever hit this
        // because we only send test_mode=false. Surface the message as-is.
        return NextResponse.json({ error: String(data.error), httpStatus: res.status }, { status: 403 })
      }
      if (!res.ok || data.error) continue
      if (data.interpret_id) return NextResponse.json(data)
    }

    const parsed = parseLeetCodeJsonText(lastText, lastRes?.status ?? 0)
    if (!parsed.ok) {
      const st = lastRes?.status
      let hint: string
      if (parsed.error === 'non_json_html') {
        if (st === 429) {
          hint =
            'LeetCode rate-limited this run (HTTP 429). Wait a bit and try again — repeated Run attempts can trigger temporary blocks.'
        } else {
          hint = `LeetCode returned HTML instead of JSON (HTTP ${st}). Your session may be expired, blocked, or rate-limited. Refresh LEETCODE_SESSION + csrftoken and try again.`
        }
      } else {
        hint = parsed.error
      }
      return NextResponse.json({ error: hint, httpStatus: st }, { status: st === 429 ? 429 : 502 })
    }

    const data = parsed.data as { error?: string }
    if (!lastRes?.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${lastRes?.status}` }, { status: lastRes?.status ?? 502 })
    }

    return NextResponse.json({ error: 'Run failed.' }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
