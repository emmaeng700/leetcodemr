import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, invalidateWarmedCreds, LC_403_HINT, resolveLcSessionCredentials, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

// LeetCode submit proxy - session + csrftoken from the editor panel.
const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titleSlug, questionId, lang, code, session, csrfToken } = body

    const { session: sess, csrf } = await resolveLcSessionCredentials(session, csrfToken, {
      titleSlug: String(titleSlug),
    })
    if (!sess || !csrf) {
      return NextResponse.json({
        error: 'Missing csrftoken. Paste csrftoken from DevTools (Application > Cookies on leetcode.com) on the same line as LEETCODE_SESSION.',
      }, { status: 401 })
    }

    const qid = toLeetCodeQuestionId(questionId)
    const slug = encodeURIComponent(String(titleSlug))
    const url = `${LC}/problems/${slug}/submit/`

    const payloads: object[] = [
      { lang, question_id: qid, typed_code: code, test_mode: false, judge_type: 'large' },
      { lang, question_id: qid, typed_code: code, test_mode: false },
    ]

    let activeSess = sess
    let activeCsrf = csrf
    let lastRes: Response | null = null
    let lastText = ''

    for (const payload of payloads) {
      const { res, text, session: nextSess, csrf: nextCsrf } = await fetchLeetCodeProblemPost(
        url,
        payload,
        String(titleSlug),
        activeSess,
        activeCsrf,
      )
      activeSess = nextSess
      activeCsrf = nextCsrf
      lastRes = res
      lastText = text

      if (res.status === 429) {
        return NextResponse.json(
          { error: 'LeetCode rate-limited this submit (HTTP 429). Wait a minute and retry.', httpStatus: 429 },
          { status: 429, headers: { 'Retry-After': '60' } },
        )
      }

      const parsed = parseLeetCodeJsonText(text, res.status)
      if (!parsed.ok) continue

      const data = parsed.data as { error?: string; submission_id?: string | number }
      if (!res.ok || data.error) continue
      if (data.submission_id != null) return NextResponse.json(data)
    }

    const parsed = parseLeetCodeJsonText(lastText, lastRes?.status ?? 0)
    if (!parsed.ok) {
      const st = lastRes?.status
      let hint: string
      if (parsed.error === 'non_json_html' && st === 403) {
        invalidateWarmedCreds(String(session ?? ''))
        hint = LC_403_HINT
      } else if (parsed.error === 'non_json_html') {
        hint = `LeetCode rejected submit (HTTP ${st}). Run your code first, then Submit right after. If it persists, refresh your session tokens.`
      } else {
        hint = parsed.error
      }
      return NextResponse.json({ error: hint, httpStatus: st }, { status: st === 429 ? 429 : 502 })
    }

    const data = parsed.data as { error?: string; submission_id?: string | number }
    if (!lastRes?.ok || data.error) {
      return NextResponse.json({ error: data.error || `LeetCode returned ${lastRes?.status}` }, { status: lastRes?.status ?? 502 })
    }

    return NextResponse.json({ error: 'Submit failed.' }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
