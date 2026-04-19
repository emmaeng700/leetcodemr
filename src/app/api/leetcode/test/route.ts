import { NextRequest, NextResponse } from 'next/server'
import { parseLeetCodeJsonText } from '@/lib/parseLeetCodeResponse'
import { fetchLeetCodeProblemPost, toLeetCodeQuestionId } from '@/lib/leetcodeHttp'

const LC = 'https://leetcode.com'

export async function POST(req: NextRequest) {
  try {
    const { titleSlug, questionId, lang, code, testInput, session, csrfToken } = await req.json()

    if (!session || !csrfToken) {
      return NextResponse.json({ error: 'Missing LEETCODE_SESSION or csrftoken' }, { status: 401 })
    }

    const qid = toLeetCodeQuestionId(questionId)
    const slug = encodeURIComponent(String(titleSlug))
    const url = `${LC}/problems/${slug}/interpret_solution/`
    const input = testInput ?? ''

    const attempts: Array<{ test_mode: boolean; data_input: string }> = [
      { test_mode: true, data_input: input },
      { test_mode: false, data_input: input },
    ]
    if (input.trim() !== '') {
      attempts.push({ test_mode: true, data_input: '' })
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
        return NextResponse.json(
          {
            error:
              'LeetCode rate-limited this run (HTTP 429). Wait a minute and try Run again — avoid spamming Run while debugging.',
            httpStatus: res.status,
          },
          { status: 429 },
        )
      }

      const parsed = parseLeetCodeJsonText(text, res.status)
      if (!parsed.ok) continue

      const data = parsed.data as { error?: string; interpret_id?: string }
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
